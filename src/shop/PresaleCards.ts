import { ObjectId } from "mongodb";
import { Blockchain, PresaleCardDepositData } from "../blockchain/Blockchain";
import { Collections } from "../database/database";
import Game from "../game";
import errors from "../knightlands-shared/errors";
import events from "../knightlands-shared/events";
import UserFlags from "../knightlands-shared/user_flags";
import { isString } from "../validation";

interface CardContent {
    tokenType: string;
    max: number;
    loot: any;
    bonusCard: string;
}

interface CardsMeta {
    cards: { [key: string]: CardContent };
}

type CardDeposits = { [k: string]: number };

interface PresaleCardsSave {
    deposits: CardDeposits;
}

function extractTokenType(tokenId: string) {
    return (BigInt(tokenId) >> 128n).toString();
}

export class PresaleCards {
    private _user: any;
    private _data: PresaleCardsSave;

    constructor(data: PresaleCardsSave, user: any) {
        if (!data.deposits) {
            data.deposits = {};
        }

        this._user = user;
        this._data = data;
    }

    verifyToken(tokenId: string) {
        return Game.founderSale.verifyTokens([tokenId], this._data.deposits);
    }

    async depositCards(tokenIds: string[], from: string, chain: string) {
        // check if card types are correct
        if (!Game.founderSale.verifyTokens(tokenIds, this._data.deposits)) {
            throw errors.IncorrectArguments;
        }

        const deposit = await Game.founderSale.createDepositRequest(this._user.id, from, chain, tokenIds);

        for (let index = 0; index < tokenIds.length; index++) {
            const tokenType = extractTokenType(tokenIds[index]);
            this._data.deposits[tokenType] = (this._data.deposits[tokenType] || 0) + 1;
        }

        return deposit;
    }
}

export class PresaleCardsService {
    private _meta: CardsMeta;
    private _blockchain: Blockchain;

    constructor(blockchain: Blockchain) {
        this._blockchain = blockchain;

        this._blockchain.on(Blockchain.PresaleCardDeposit, this._handleCardsDeposit.bind(this));
    }

    async init() {
        await Game.db.collection(Collections.PresaleCardDeposits).createIndex({ user: 1 });
        this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "presale_cards" });
    }

    verifyTokens(tokenIds: string[], currentDeposits: CardDeposits) {
        const depositCopy = { ...currentDeposits };

        for (let index = 0; index < tokenIds.length; index++) {
            const cardType = extractTokenType(tokenIds[index]);
            const cardMeta = this._meta.cards[cardType];
            if (!cardMeta) {
                return false;
            }

            if (cardType != cardMeta.tokenType) {
                return false;
            }

            if (depositCopy[cardType] >= cardMeta.max) {
                return false;
            }

            depositCopy[cardType]++;
        }

        return true;
    }

    async createDepositRequest(userId: ObjectId, from: string, blockchainId: string, tokenIds: string[]) {
        for (const tokenId of tokenIds) {
            if (!isString(tokenId)) {
                throw errors.IncorrectArguments;
            }
        }

        const found = await Game.db.collection(Collections.PresaleCardDeposits).findOne({ user: userId, chain: blockchainId, tokenIds: { $all: tokenIds } });
        if (found) {
            throw errors.IncorrectArguments;
        }

        let depositId = (await Game.db.collection(Collections.PresaleCardDeposits).insertOne({
            user: userId,
            from,
            chain: blockchainId,
            pending: true,
            tokenIds,
            date: Game.nowSec
        })).insertedId.toHexString();

        return {
            depositId,
            tokenIds
        };
    }

    private async _handleCardsDeposit(chain: string, data: PresaleCardDepositData) {
        const depositData = await Game.db.collection(Collections.PresaleCardDeposits).findOne({ _id: new ObjectId(data.depositId) });
        if (!depositData) {
            await this._logError("unknown deposit", data);
            return;
        }

        if (!depositData.pending) {
            await this._logError("double deposit", data);
            return;
        }

        const user = await Game.getUserById(depositData.user);
        if (!user) {
            await this._logError("unknown user", data);
            return;
        }

        await user.autoCommitChanges(async () => {
            // assign card goodies!
            for (const tokenId of data.tokenIds) {
                const presaleCardMeta = this._meta.cards[extractTokenType(tokenId)];

                // add subscription
                if (presaleCardMeta.bonusCard) {
                    const cardMeta = await Game.shop.getCardMeta(presaleCardMeta.bonusCard);
                    const cards = user.cards;
                    if (!cards[presaleCardMeta.bonusCard]) {
                        cards[presaleCardMeta.bonusCard] = {
                            end: Game.nowSec
                        };
                    }
                    cards[presaleCardMeta.bonusCard].end += cardMeta.duration;
                }

                // items
                const items = await Game.lootGenerator.getLootFromTable(presaleCardMeta.loot.table);
                await user.inventory.addItemTemplates(items)

                // mark user as early presale buyer
                user.setFlag(UserFlags.Presale0, true);
            }
        });

        await Game.db.collection(Collections.PresaleCardDeposits).updateOne({ _id: new ObjectId(data.depositId) }, { $set: { pending: false } });
        Game.emitPlayerEvent(depositData.user, events.FounderPackAcquired, { tokenIds: data.tokenIds.map(x => x.toString()) });
    }

    async _logError(error: string, data: PresaleCardDepositData) {
        await Game.db.collection(Collections.PresaleCardDeposits).insertOne({ error, data });
    }
}