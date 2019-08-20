'use strict';

const { Collections } = require("./database");
import CurrencyType from "./knightlands-shared/currency_type";
import Game from "./game";
const uuidv4 = require('uuid/v4');

// Price in TRX
const PresalePrices = {
    0: 500,
    1: 1500,
    2: 5000,
    3: 7500
};

const PresaleChestToGacha = {
    0: "rookie_presale_chest",
    1: "lieutenant_presale_chest",
    2: "knight_presale_chest",
    3: "king_presale_chest"
};

const ReferralSystem = {
    500: {
        referer: 4,
        referee: 1
    },
    4000: {
        referer: 15,
        referee: 5
    }
}

class Presale {
    constructor(http) {
        this._http = http;
        this._db = Game.db;

        this.ChestTransfered = "chest_transfered";
        this.ChestPurchased = "chest_purchased";

        http.get('/prices', this._getPrices.bind(this));
        http.get('/get/presaleChests', this._getPresaleChests.bind(this));
        http.get('/open/presaleChest', this._openPresaleChest.bind(this));

        this._blockchain = Game.blockchain;
        this._blockchain.on(this._blockchain.PresaleChestTransfer, this._handlePresaleChestTransfer.bind(this));
        this._blockchain.on(this._blockchain.PresaleChestPurchased, this._handlePresaleChestPurchased.bind(this));
    }

    _getPrices(req, res) {
        res.json(PresalePrices);
    }

    async _getPresaleChests(req, res) {
        let wallet = req.query.wallet;
        let chests = await this._db.collection(Collections.PresaleChests).findOne({ user: wallet });
        res.json(chests);
    }

    async _handlePresaleChestTransfer(args) {
        let exists = await this._db.collection(Collections.PresaleChestsLogs).findOne({ tx: args.tx });
        if (exists) {
            return;
        }

        args.type = this.ChestTransfered;
        await this._db.collection(Collections.PresaleChestsLogs).insertOne(args);

        let update = { $inc: {}, $setOnInsert: {}, $set: { openingToken: uuidv4() } };
        update.$inc[`chest.${args.chestId}.total`] = args.amount * 1;
        update.$setOnInsert[`chest.${args.chestId}.opened`] = 0;
        await this._db.collection(Collections.PresaleChests).updateOne({ user: args.user }, update, { upsert: true });
    }

    async _handlePresaleChestPurchased(args) {
        let exists = await this._db.collection(Collections.PresaleChestsLogs).findOne({ tx: args.tx });
        if (exists) {
            return;
        }

        args.type = this.ChestPurchased;
        await this._db.collection(Collections.PresaleChestsLogs).insertOne(args);

        if (this._blockchain.isAddress(args.referer)) {
            let query = { $set: { referer: args.referer }, $inc: { totalAmount: PresalePrices[args.chestId] } };
            await this._db.collection(Collections.PresaleChests).updateOne({ user: args.user }, query, { upsert: true });

            let presaleStatus = await this._db.collection(Collections.PresaleChests).findOne({ user: args.user });
            let referralBonus = presaleStatus.referralBonus || {};
            let changes = {
                referer: 0,
                referee: 0
            };
            let newBonus = false;
            for (let totalPurchaseAmount in ReferralSystem) {
                totalPurchaseAmount = totalPurchaseAmount * 1;

                if (referralBonus[totalPurchaseAmount]) {
                    continue;
                }

                if (totalPurchaseAmount <= presaleStatus.totalAmount) {
                    newBonus = true;
                    referralBonus[totalPurchaseAmount] = true;
                    let bonus = ReferralSystem[totalPurchaseAmount];
                    changes.referer += bonus.referer;
                    changes.referee += bonus.referee;
                }
            }

            if (newBonus) {
                let refererInventory = await Game.loadInventory(args.referer);
                await refererInventory.autoCommitChanges(inv => {
                    inv.modifyCurrency(CurrencyType.Dkt, changes.referer);
                });

                let userInventory = await Game.loadInventory(args.user);
                await userInventory.autoCommitChanges(inv => {
                    inv.modifyCurrency(CurrencyType.Dkt, changes.referee);
                });

                await this._db.collection(Collections.PresaleChests).updateOne({ user: args.user }, { $set: { referralBonus: referralBonus } });
            }
        }
    }

    async _openPresaleChest(req, res) {
        const { chestId, wallet, signature } = req.query;

        let presaleStatus = await this._db.collection(Collections.PresaleChests).findOne({ user: wallet });

        if (!presaleStatus || !presaleStatus.chest || !presaleStatus.chest[chestId]) {
            res.status(500).end("no presale chests");
            return;
        }

        let chestStatus = presaleStatus.chest[chestId];

        if (chestStatus.total <= chestStatus.opened) {
            res.status(500).end("all chests are opened");
            return;
        }

        // verify sign first, it is consist of unique token + wallet and token will be updated on successfull opening
        let messageToVerify = `${presaleStatus.openingToken}${wallet}`;
        let signVerified = await this._blockchain.verifySign(messageToVerify, signature, wallet);
        if (!signVerified) {
            res.status(500).end("signature verification failed");
            return;
        }

        let newOpeningToken = uuidv4();
        let updateQuery = {
            $set: { openingToken: newOpeningToken },
            $push: {
                logs: {
                    timestamp: new Date().getTime() / 1000,
                    chestId
                }
            }, $inc: {}
        };

        updateQuery.$inc[`chest.${chestId}.opened`] = 0;
        // log, count chest as opened and generate new open token
        await this._db.collection(Collections.PresaleChests).updateOne({ user: wallet }, updateQuery);
        // everything is ok - generate items and assign to inventory
        let items = await Game.lootGenerator.getLootFromGacha(PresaleChestToGacha[chestId]);
        let inventory = await Game.loadInventory(wallet);
        await inventory.addItemTemplates(items);
        await inventory.commitChanges();

        res.json({
            loot: items,
            token: newOpeningToken,
            chestsLeft: chestStatus.total - chestStatus.opened - 1 // 1 was just opened
        }).end();
    }
};

module.exports = Presale;