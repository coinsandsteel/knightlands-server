'use strict';

const { Collections } = require("./database");
import CurrencyType from "./knightlands-shared/currency_type";
import Game from "./game";
const uuidv4 = require('uuid/v4');
const CBuffer = require("./CBuffer");

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

const PresaleFeedDBEntry = "presale_feed";

class Presale {
    constructor(http) {
        this._http = http;
        this._db = Game.db;

        // hold last 20 drops
        this._presaleFeed = new CBuffer(20);

        this.ChestTransfered = "chest_transfered";
        this.ChestPurchased = "chest_purchased";

        http.get('/get/prices', this._getPrices.bind(this));
        http.get('/get/presaleFeed', this._getPresaleFeed.bind(this));
        http.get('/get/inventory', this._fetchInventory.bind(this));
        http.get('/get/presaleChests', this._getPresaleChests.bind(this));
        http.get('/get/referrals', this._getReferrals.bind(this));
        http.get('/open/presaleChest', this._openPresaleChest.bind(this));

        this._blockchain = Game.blockchain;
        this._blockchain.on(this._blockchain.PresaleChestTransfer, this._handlePresaleChestTransfer.bind(this));
        this._blockchain.on(this._blockchain.PresaleChestPurchased, this._handlePresaleChestPurchased.bind(this));
    }

    _getPrices(req, res) {
        res.json(PresalePrices);
    }

    async init() {
        let data = await this._db.collection(Collections.PresaleData).findOne({ _id: PresaleFeedDBEntry });
        if (data && Array.isArray(data.feed)) {
            let i = 0;
            const length = data.feed.length;
            for (; i < length; ++i) {
                this._presaleFeed.push(data.feed[i]);
            }
        }
    }

    async _getPresaleFeed(req, res) {
        res.json(this._presaleFeed.toArray());
    }

    async _fetchInventory(req, res) {
        if (!req.query.wallet) {
            res.json({});
            return;
        }

        let user = await Game.loadUser(req.query.wallet);
        let items = await user.loadInventory();

        let summary = {
            softCurrency: user.softCurrency,
            hardCurrency: user.hardCurrency,
            dkt: user.dkt,
            items: items
        }

        res.json(summary);
    }

    async _getPresaleChests(req, res) {
        let wallet = req.query.wallet;
        let chests = await this._db.collection(Collections.PresaleChests).findOne({ user: wallet });
        res.json(chests);
    }

    async _getReferrals(req, res) {
        let wallet = req.query.wallet;
        let referees = await this._db.collection(Collections.PresaleChests).find({ referer: wallet }).toArray();

        let referralData = {
            totalDkt: 0,
            referees: []
        };

        if (referees && referees.length > 0) {
            let i = 0;
            const length = referees.length;

            for (; i < length; ++i) {
                let referee = referees[i];
                let refereeBonus = {
                    id: referee.user,
                    dkt: 0
                };
                // get over the bonuses claimed and count total DKT generated for the referrer
                for (let bonusId in referee.referralBonus) {
                    let bonus = ReferralSystem[bonusId];
                    refereeBonus.dkt += bonus.referer;
                }

                referralData.referees.push(refereeBonus);
                referralData.totalDkt += refereeBonus.dkt;
            }
        }

        res.json(referralData);
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

        // smart contract ensures that there is always only 1 referer per buyer
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

        // everything is ok - generate items and assign to inventory
        let items = await Game.lootGenerator.getLootFromGacha(PresaleChestToGacha[chestId]);
        let inventory = await Game.loadInventory(wallet);
        await inventory.addItemTemplates(items);
        await inventory.commitChanges();

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
        updateQuery.$inc[`chest.${chestId}.opened`] = 1;
        // log, count chest as opened and generate new open token
        await this._db.collection(Collections.PresaleChests).updateOne({ user: wallet }, updateQuery);

        // if there is Epic+ item drops -> push them to presale feed
        let templateIds = new Array(items.length);
        let i = 0;
        const length = items.length;
        for (; i < length; ++i) {
            templateIds[i] = items[i].item;
        }

        // note that we can't run over 20 items because biggest chest has 10 items to roll
        let feed = [];
        let itemTemplates = await Game.itemTemplates.getTemplates(templateIds);
        for (i = 0; i < length; ++i) {
            if (i >= itemTemplates.length) {
                break;
            }

            let rarity = itemTemplates[i].rarity;
            if (rarity != "common" && rarity != "rare" && !items[i].guaranteed) {
                let feedItem = {
                    user: wallet,
                    item: {
                        item: items[i].item,
                        quantity: items[i].quantity
                    }
                };
                // add to stream array
                feed.push(feedItem);
                // add to feed storage
                this._presaleFeed.push(feedItem);
            }
        }

        await this._db.collection(Collections.PresaleChestsLogs).insertOne({ user: wallet }, { "type": "chest_opened", items: feed });

        if (feed.length > 0) {
            // save to retrieve when service restarted
            await this._db.collection(Collections.PresaleData).updateOne({ _id: PresaleFeedDBEntry }, { $set: { "feed": this._presaleFeed.toArray() } }, { upsert: true })
            Game.publishToChannel("presale", feed);
        }

        res.json({
            loot: items,
            token: newOpeningToken,
            chestsLeft: chestStatus.total - chestStatus.opened - 1 // 1 was just opened
        }).end();
    }
};

module.exports = Presale;