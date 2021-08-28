'use strict';

const { ethers } = require("ethers");
import Game from "./game";
const uuidv4 = require('uuid/v4');
const CBuffer = require("./CBuffer");
const TronWeb = require("tronweb");

// Price in TRX
const PresalePrices = {
    0: 500,
    1: 1000,
    2: 5000,
    3: 7500,
    4: 800
};

const PresaleChestToGacha = {
    0: "rookie_presale_chest",
    1: "lieutenant_presale_chest",
    2: "knight_presale_chest",
    3: "king_presale_chest",
    4: "lovehearts_presale"
};

const ReferralSystem = {
    500: {
        referer: 1,
        referee: 0.3
    },
    1500: {
        referer: 4,
        referee: 1
    },
    2500: {
        referer: 6.5,
        referee: 3
    },
    5000: {
        referer: 15,
        referee: 5
    },
    12500: {
        referer: 40,
        referee: 15
    },
    25000: {
        referer: 90,
        referee: 35
    },
    50000: {
        referer: 200,
        referee: 80
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

        http.get('/allow/cs', this._allowForCoins.bind(this))
        http.get('/request/cs', this._requestForCoins.bind(this))

        http.get('/allow/kl', this._allowForKL.bind(this))
        http.get('/request/kl', this._requestForKL.bind(this))

        this.provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/e60e5ebd4d2a47e090df904b8408e8a3");
        // http.get('/get/prices', this._getPrices.bind(this));
        // http.get('/get/presaleFeed', this._getPresaleFeed.bind(this));
        // http.get('/get/inventory', this._fetchInventory.bind(this));
        // http.get('/get/presaleChests', this._getPresaleChests.bind(this));
        // http.get('/get/referrals', this._getReferrals.bind(this));
        // http.get('/open/presaleChest', this._openPresaleChest.bind(this));

        // this._blockchain = Game.blockchain;
        // this._blockchain.on(this._blockchain.PresaleChestTransfer, this._handlePresaleChestTransfer.bind(this));
        // this._blockchain.on(this._blockchain.PresaleChestPurchased, this._handlePresaleChestPurchased.bind(this));
    }

    async init() {
        this._tronWeb = new TronWeb({
            fullHost: "https://api.trongrid.io",
            privateKey: "b7b1a157b3eef94f74d40be600709b6aeb538d6d8d637f49025f4c846bd18200"
        });
    }

    async _requestForKL(req, res) {
        const tronWallet = req.query.wallet
        const hexWallet = this._tronWeb.address.toHex(tronWallet).replace(/^(41)/, '');

        let data = await this._db.collection("kl_requests").findOne({ wallet: tronWallet })
        if (data) {
            res.json({ msg: data._id.toString() })
            return;
        }

        const inserted = await this._db.collection("kl_requests").insertOne({
            wallet: tronWallet,
            hexWallet
        })

        res.json({ msg: inserted.insertedId.toString() })
    }

    async _allowForKL(req, res) {
        const { wallet, mm, signature } = req.query;

        let request = await this._db.collection("kl_requests").findOne({ wallet })
        if (request && request.allowed) {
            res.json({ error: "allowance claimed", allowance: request.allowance });
            return;
        }

        const tokens = await this._db.collection("knightlands_presale").find({ owner: `0x${request.hexWallet}` }).toArray();
        if (!tokens || tokens.length == 0) {
            res.json({ error: "no tokens" });
            return;
        }

        // check signature
        const id = request._id.toString();
        const hash = this._tronWeb.sha3(id)
        const isCorrect = await this._tronWeb.trx.verifyMessage(hash, signature, request.wallet);

        if (!isCorrect) {
            res.json({ error: "incorrect signer" });
            return;
        }

        const trxPrice = 0.015
        let allowance = 0
        for (const token of tokens) {
            let price = 0

            switch (token.tokenId) {
                case 0:
                    price = 500
                case 1:
                    price = 1000
                case 2:
                    price = 5000
                case 3:
                    price = 7500
            }

            allowance += price * token.amount * trxPrice
        }

        await this._db.collection("kl_allowence").insertOne({ wallet, allowance, ethWallet: mm })

        res.json({ ok: true, allowance })
    }

    async _allowForCoins(req, res) {
        const { wallet, signature } = req.query;

        let request = await this._db.collection("coins_requests").findOne({ wallet })
        if (request && request.allowed) {
            res.json({ error: "allowance claimed", allowance: request.allowance });
            return;
        }

        const tokens = await this._db.collection("coins_and_steel").find({ owner: wallet }).toArray();
        if (!tokens || tokens.length == 0) {
            res.json({ error: "no tokens" });
            return;
        }

        // check signature
        const id = request._id.toString();
        const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(id))
        const signer = ethers.utils.verifyMessage(ethers.utils.arrayify(hash), signature);

        if (signer !== request.wallet) {
            res.json({ error: "incorrect signer" });
            return;
        }

        await this._db.collection("coins_allowence").insertOne({ wallet, allowance: 0.19 * tokens.length * 450 })

        res.json({ ok: true, allowance: 0.19 * tokens.length * 450 })
    }

    async _requestForCoins(req, res) {
        let data = await this._db.collection("coins_requests").findOne({ wallet: req.query.wallet })
        if (data) {
            res.json({ msg: data._id.toString() })
            return;
        }

        const inserted = await this._db.collection("coins_requests").insertOne({
            wallet: req.query.wallet,
        })

        res.json({ msg: inserted.insertedId.toString() })
    }

    // async _getPresaleFeed(req, res) {
    //     res.json(this._presaleFeed.toArray());
    // }

    // async _fetchInventory(req, res) {
    //     if (!req.query.wallet) {
    //         res.json({});
    //         return;
    //     }

    //     let user = await Game.loadUser(req.query.wallet);
    //     let items = await user.loadInventory();

    //     let summary = {
    //         softCurrency: user.softCurrency,
    //         hardCurrency: user.hardCurrency,
    //         dkt: user.dkt,
    //         items: items
    //     }

    //     res.json(summary);
    // }

    // async _getPresaleChests(req, res) {
    //     let wallet = req.query.wallet;
    //     let chests = await this._db.collection(Collections.PresaleChests).findOne({ user: wallet });
    //     res.json(chests);
    // }

    // async _getReferrals(req, res) {
    //     let wallet = req.query.wallet;
    //     let referees = await this._db.collection(Collections.PresaleChests).find({ referer: wallet }).toArray();

    //     let referralData = {
    //         totalDkt: 0,
    //         referees: []
    //     };

    //     if (referees && referees.length > 0) {
    //         let i = 0;
    //         const length = referees.length;

    //         for (; i < length; ++i) {
    //             let referee = referees[i];
    //             let refereeBonus = {
    //                 id: referee.user,
    //                 dkt: 0
    //             };
    //             // get over the bonuses claimed and count total DKT generated for the referrer
    //             for (let bonusId in referee.referralBonus) {
    //                 let bonus = ReferralSystem[bonusId];
    //                 refereeBonus.dkt += bonus.referer;
    //             }

    //             referralData.referees.push(refereeBonus);
    //             referralData.totalDkt += refereeBonus.dkt;
    //         }
    //     }

    //     res.json(referralData);
    // }

    // async _handlePresaleChestTransfer(args) {
    //     let exists = await this._db.collection(Collections.PresaleChestsLogs).findOne({ tx: args.tx });
    //     if (exists) {
    //         return;
    //     }

    //     args.type = this.ChestTransfered;
    //     await this._db.collection(Collections.PresaleChestsLogs).insertOne(args);

    //     let update = { $inc: {}, $setOnInsert: {}, $set: { openingToken: uuidv4() } };
    //     update.$inc[`chest.${args.chestId}.total`] = args.amount * 1;
    //     update.$setOnInsert[`chest.${args.chestId}.opened`] = 0;
    //     await this._db.collection(Collections.PresaleChests).updateOne({ user: args.user }, update, { upsert: true });
    // }

    // async _handlePresaleChestPurchased(args) {
    //     let exists = await this._db.collection(Collections.PresaleChestsLogs).findOne({ tx: args.tx });
    //     if (exists) {
    //         return;
    //     }

    //     args.type = this.ChestPurchased;
    //     await this._db.collection(Collections.PresaleChestsLogs).insertOne(args);

    //     // smart contract ensures that there is always only 1 referer per buyer
    //     if (this._blockchain.isAddress(args.referer)) {
    //         let query = { $set: { referer: args.referer }, $inc: { totalAmount: PresalePrices[args.chestId] } };
    //         await this._db.collection(Collections.PresaleChests).updateOne({ user: args.user }, query, { upsert: true });

    //         let presaleStatus = await this._db.collection(Collections.PresaleChests).findOne({ user: args.user });
    //         let referralBonus = presaleStatus.referralBonus || {};
    //         let changes = {
    //             referer: 0,
    //             referee: 0
    //         };
    //         let newBonus = false;
    //         for (let totalPurchaseAmount in ReferralSystem) {
    //             totalPurchaseAmount = totalPurchaseAmount * 1;

    //             if (referralBonus[totalPurchaseAmount]) {
    //                 continue;
    //             }

    //             if (totalPurchaseAmount <= presaleStatus.totalAmount) {
    //                 newBonus = true;
    //                 referralBonus[totalPurchaseAmount] = true;
    //                 let bonus = ReferralSystem[totalPurchaseAmount];
    //                 changes.referer += bonus.referer;
    //                 changes.referee += bonus.referee;
    //             }
    //         }

    //         if (newBonus) {
    //             let refererInventory = await Game.loadInventory(args.referer);
    //             await refererInventory.autoCommitChanges(async inv => {
    //                 await inv.modifyCurrency(CurrencyType.Dkt, changes.referer);
    //             });

    //             let userInventory = await Game.loadInventory(args.user);
    //             await userInventory.autoCommitChanges(async inv => {
    //                 await inv.modifyCurrency(CurrencyType.Dkt, changes.referee);
    //             });

    //             await this._db.collection(Collections.PresaleChests).updateOne({ user: args.user }, { $set: { referralBonus: referralBonus } });
    //         }
    //     }
    // }

    // async _openPresaleChest(req, res) {
    //     const { chestId, wallet, signature } = req.query;

    //     let presaleStatus = await this._db.collection(Collections.PresaleChests).findOne({ user: wallet });

    //     if (!presaleStatus || !presaleStatus.chest || !presaleStatus.chest[chestId]) {
    //         res.status(500).end("no presale chests");
    //         return;
    //     }

    //     let chestStatus = presaleStatus.chest[chestId];

    //     if (chestStatus.total <= chestStatus.opened) {
    //         res.status(500).end("all chests are opened");
    //         return;
    //     }

    //     // verify sign first, it is consist of unique token + wallet and token will be updated on successfull opening
    //     let messageToVerify = `${presaleStatus.openingToken}${wallet}`;
    //     let signVerified = await this._blockchain.verifySign(messageToVerify, signature, wallet);
    //     if (!signVerified) {
    //         res.status(500).end("signature verification failed");
    //         return;
    //     }

    //     // everything is ok - generate items and assign to inventory
    //     let items = await Game.lootGenerator.getLootFromGacha(wallet, PresaleChestToGacha[chestId]);
    //     let inventory = await Game.loadInventory(wallet);
    //     await inventory.addItemTemplates(items);
    //     await inventory.commitChanges();

    //     let newOpeningToken = uuidv4();
    //     let updateQuery = {
    //         $set: { openingToken: newOpeningToken },
    //         $push: {
    //             logs: {
    //                 timestamp: new Date().getTime() / 1000,
    //                 chestId
    //             }
    //         },
    //         $inc: {}
    //     };
    //     updateQuery.$inc[`chest.${chestId}.opened`] = 1;
    //     // log, count chest as opened and generate new open token
    //     await this._db.collection(Collections.PresaleChests).updateOne({ user: wallet }, updateQuery);

    //     // if there is Epic+ item drops -> push them to presale feed
    //     let templateIds = new Array(items.length);
    //     let i = 0;
    //     const length = items.length;
    //     for (; i < length; ++i) {
    //         templateIds[i] = items[i].item;
    //     }

    //     // note that we can't run over 20 items because biggest chest has 10 items to roll
    //     let feed = [];
    //     let itemTemplates = await Game.itemTemplates.getTemplates(templateIds);
    //     for (i = 0; i < length; ++i) {
    //         if (i >= itemTemplates.length) {
    //             break;
    //         }

    //         let rarity = itemTemplates[i].rarity;
    //         if (rarity != "common" && rarity != "rare" && !items[i].guaranteed) {
    //             let feedItem = {
    //                 user: wallet,
    //                 item: {
    //                     item: items[i].item,
    //                     quantity: items[i].quantity
    //                 }
    //             };
    //             // add to stream array
    //             feed.push(feedItem);
    //             // add to feed storage
    //             this._presaleFeed.push(feedItem);
    //         }
    //     }

    //     await this._db.collection(Collections.PresaleChestsLogs).insertOne({ user: wallet, "type": "chest_opened", items: feed, chestId: chestId });

    //     if (feed.length > 0) {
    //         // save to retrieve when service restarted
    //         await this._db.collection(Collections.PresaleData).updateOne({ _id: PresaleFeedDBEntry }, { $set: { "feed": this._presaleFeed.toArray() } }, { upsert: true })
    //         Game.publishToChannel("presale", feed);
    //     }

    //     res.json({
    //         loot: items,
    //         token: newOpeningToken,
    //         chestsLeft: chestStatus.total - chestStatus.opened - 1 // 1 was just opened
    //     }).end();
    // }
};

module.exports = Presale;