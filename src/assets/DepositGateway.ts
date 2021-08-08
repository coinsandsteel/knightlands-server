import { Blockchain, TokenDepositData } from "../blockchain/Blockchain";
import { Lock } from "../utils/lock";
import Game from "../game";
import { Collections } from "../database/database";
import { ObjectId, ReturnDocument } from "mongodb";
import currency_type from "../knightlands-shared/currency_type";

export class DepositGateway {
    private _blockchain: Blockchain;

    constructor(blockchain: Blockchain) {
        this._blockchain = blockchain;
        this._blockchain.on(Blockchain.TokenDeposit, this.handleTokenDeposit.bind(this));
    }

    public async createDepositor(userId: string) {
        const found = await Game.db.collection(Collections.Depositors).findOneAndUpdate(
            { userId },
            {
                $setOnInsert: {
                    userId
                }
            },
            {
                returnDocument: ReturnDocument.AFTER,
                upsert: true
            }
        );
        return found.value._id.toHexString();
    }

    private async handleTokenDeposit(chain: string, data: TokenDepositData) {
        const depositor = await Game.db.collection(Collections.Depositors).findOne({ _id: new ObjectId(data.depositorId) });

        if (!depositor) {
            await Game.db.collection(Collections.TokenDepositErrors).insertOne({ status: "error", reason: `unknown depositor`, data });
            return;
        }

        const user = await Game.getUserById(depositor.userId.toHexString());
        const inventory = user.inventory;
        const blockhain = this._blockchain.getBlockchain(chain);
        const amount = blockhain.convertTokenAmount(data.amount);

        await Game.dbClient.withTransaction(async db => {
            if (blockhain.getTokenAddress(currency_type.Dkt) == data.token) {
                data.currency = currency_type.Dkt;
                await inventory.autoCommitChanges(() => inventory.modifyCurrency(currency_type.Dkt, amount), db);
            } else if (blockhain.getTokenAddress(currency_type.Dkt2) == data.token) {
                data.currency = currency_type.Dkt2;
                await inventory.autoCommitChanges(() => inventory.modifyCurrency(currency_type.Dkt2, amount), db);
            }

            await Game.activityHistory.save(db, user.address, 'token-d', chain, data);
        })
    }
}