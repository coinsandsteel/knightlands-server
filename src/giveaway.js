'use strict';

const { Collections } = require("./database/database");
const BotGiveawayWhitelist = require("./botGiveawayWhitelist");
const Config = require("./config");
import Game from "./game";
const uuidv4 = require('uuid/v4');

const WelcomeGifts = {
    softCurrency: 25000,
    items: [{ item: 648, quantity: 1 }, { item: 649, quantity: 1 }, { item: 650, quantity: 1 }]
}

class Giveaway {
    constructor(http) {
        this._db = Game.db;
        this._signVerifier = Game.blockchain;

        http.post('/give', [this._requiresApiKey.bind(this)], this._giveItem.bind(this));
        http.post('/getSigninKey', [this._requiresApiKey.bind(this)], this._getSigninKey.bind(this));

        // http.get('/check/welcomeStatus', this._checkWelcomeStatus.bind(this));
        http.post('/link/telegram', this._linkTelegram.bind(this));
        http.post('/link/email', this._linkEmail.bind(this));
        http.post('/get/welcomeKey', this._getWelcomeKey.bind(this));
        // http.post('/claim/welcomePackage', this._claimWelcomePackage.bind(this));
        http.get('/generateMailLink', this._generateMailLink.bind(this));
    }

    async _getWelcomeKey(req, res) {
        try {
            let token = uuidv4();
            await this._db.collection(Collections.Giveaways).updateOne({ wallet: req.body.wallet }, {
                $set: { "welcomeSignup.token": token }
            }, { upsert: true });
            res.json({ token });
        } catch (exc) {
            console.log(exc);
            res.status(500).end();
        }
    }

    async _claimWelcomePackage(req, res) {
        let walletAddress = req.body.wallet;

        if (!walletAddress) {
            res.status(500).end();
            return;
        }

        let giveaways = await this._db.collection(Collections.Giveaways).findOne({ wallet: walletAddress, "welcomeSignup.token": { $exists: true } });
        if (giveaways && !giveaways.welcomeSignup.claimed) {
            let signature = req.body.signature;
            let result = await this._signVerifier.verifySign(`${giveaways.welcomeSignup.token}${walletAddress}`, signature, walletAddress);
            if (result) {
                let giveResult = await this._tryGiveWelcomeSigninPackage(walletAddress);
                res.json(giveResult);
            } else {
                res.status(500).end("failed sign verification");
            }
        } else if (giveaways.welcomeSignup.claimed) {
            res.status(500).end("claimed");
        } else {
            res.status(500).end("no token");
        }
    }

    async _getSigninKey(req, res) {
        let tgUser = req.body.userId;
        try {
            let token = uuidv4();
            await this._db.collection(Collections.LinkedAccounts).updateOne({ tgUser: tgUser }, {
                $set: { linkToken: token }
            }, { upsert: true });

            res.json({ token });
        } catch (exc) {
            console.log(exc);
            res.status(500).end();
        }
    }

    async _giveItem(req, res) {
        // check if such item exist
        let itemId = BotGiveawayWhitelist[req.body.itemId];
        if (!itemId) {
            res.status(500).end("unknown item");
            return;
        }

        let linkedAccount = await this._db.collection(Collections.LinkedAccounts).findOne({ tgUser: req.body.user });
        if (!linkedAccount) {
            res.status(500).end("no account");
            return;
        }

        if (!linkedAccount.wallet) {
            res.status(500).end("no wallet");
            return;
        }

        let itemTemplate = await Game.itemTemplates.getTemplate(itemId);

        if (!itemTemplate) {
            res.status(500).end("unknown item");
            return;
        }

        let user = await Game.loadUser(linkedAccount.wallet);
        await user.loadInventory();

        await user.inventory.addItemTemplates([{
            item: itemTemplate._id,
            quantity: 1
        }]);
        await user.commitChanges();

        await this._db.collection(Collections.GiveawayLogs).insertOne({ user: req.body.user, item: itemTemplate._id });

        // send item's image url for the telegram bot
        res.json({
            media: `https://game.knightlands.com:9000/img/${itemTemplate.icon}.mp4`,
            caption: itemTemplate.caption
        });
    }

    _requiresApiKey(req, res, next) {
        let apiKey = req.headers["api-key"];
        if (apiKey !== Config.botApiKey) {
            res.status(403).end();
        } else {
            next();
        }
    }

    async _checkWelcomeStatus(req, res) {
        let welcomeClaimed = await this._db.collection(Collections.Giveaways).findOne({ wallet: req.query.wallet, "welcomeSignup.claimed": true });

        if (welcomeClaimed) {
            res.json({ ok: false });
        } else {
            res.json({ ok: true });
        }
    }

    async _linkEmail(req, res) {
        const { email, signature, address } = req.body;
        let linkedAccount = await this._db.collection(Collections.LinkedAccounts).findOne({ mail: email });

        if (!linkedAccount) {
            res.status(500).end("incorrect sign in link");
            return;
        }

        if (linkedAccount.linked && linkedAccount.linked.mail) {
            res.status(500).end("linked");
            return;
        }

        // also check that this wallet is not linked yet
        let walletLinked = await this._db.collection(Collections.LinkedAccounts).findOne({ wallet: address });
        if (walletLinked && walletLinked._id.toHexString() != linkedAccount._id.toHexString()) {
            res.status(500).end("linked");
            return;
        }

        let result = await this._signVerifier.verifySign(`${linkedAccount.mailToken}${email}`, signature, address);
        if (result) {
            let giveResult = await this._tryGiveWelcomeSigninPackage(address);

            await this._db.collection(Collections.LinkedAccounts).updateOne({ mail: email }, {
                $set: { "linked.mail": true, wallet: address },
                $unset: { mailToken: "" }
            });

            res.json(giveResult);
        } else {
            res.status(500).end("failed sign verification");
        }
    }

    async _linkTelegram(req, res) {
        let tgUser = req.body.user * 1;
        let linkedAccount = await this._db.collection(Collections.LinkedAccounts).findOne({ tgUser: tgUser });

        if (!linkedAccount) {
            res.status(500).end("incorrect sign in link");
            return;
        }

        if (linkedAccount.linked && linkedAccount.linked.tg) {
            res.status(500).end("linked");
            return;
        }

        let walletAddress = req.body.address;

        // also check that this wallet is not linked yet
        let walletLinked = await this._db.collection(Collections.LinkedAccounts).findOne({ wallet: walletAddress });
        if (walletLinked && walletLinked._id.toHexString() != linkedAccount._id.toHexString()) {
            res.status(500).end("linked");
            return;
        }

        let signature = req.body.signature;

        let result = await this._signVerifier.verifySign(`${linkedAccount.linkToken}${tgUser}`, signature, walletAddress);
        if (result) {
            let giveResult = await this._tryGiveWelcomeSigninPackage(walletAddress);

            await this._db.collection(Collections.LinkedAccounts).updateOne({ tgUser: tgUser }, {
                $set: { "linked.tg": true, wallet: walletAddress },
                $unset: { linkToken: "" }
            });

            res.json(giveResult);
        } else {
            res.status(500).end("failed sign verification");
        }
    }

    async _tryGiveWelcomeSigninPackage(walletAddress) {
        let giveaways = await this._db.collection(Collections.Giveaways).findOne({ wallet: walletAddress });

        if (!giveaways || !giveaways.welcomeSignup || !giveaways.welcomeSignup.claimed) {
            // give welcome loot
            let user = await Game.loadUser(walletAddress);

            await user.addSoftCurrency(WelcomeGifts.softCurrency);
            await user.loadInventory();
            await user.inventory.addItemTemplates(WelcomeGifts.items);

            await user.commitChanges();

            await this._db.collection(Collections.Giveaways).updateOne({ wallet: walletAddress }, {
                $set: { wallet: walletAddress, welcomeSignup: { claimed: true } }
            }, { upsert: true });

            return WelcomeGifts;
        }

        return {};
    }

    async _generateMailLink(req, res) {
        let token = uuidv4();
        await this._db.collection(Collections.LinkedAccounts).updateOne({ mail: req.query.mail }, {
            $set: { mailToken: token }
        }, { upsert: true });

        res.json({
            url: `https://inventory.knightlands.com/#/linkmail/${token}/${req.query.mail}`
        });
    }
};

module.exports = Giveaway;