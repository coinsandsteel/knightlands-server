'use strict';

const { Collections } = require("./database");
const BotGiveawayWhitelist = require("./botGiveawayWhitelist");
const Config = require("./config");
import Game from "./game";
const uuidv4 = require('uuid/v4');

const WelcomeGifts = {
    softCurrency: 25000,
    items: {
        "139": 1
    }
}

class Giveaway {
    constructor(db, http, signVerifier) {
        this._db = db;
        this._signVerifier = signVerifier;

        let requestGuards = [this._requiresApiKey.bind(this)];

        http.post('/give', requestGuards, this._giveItem.bind(this));
        http.post('/getSigninKey', requestGuards, this._getSigninKey.bind(this));
        http.get('/inventory', this._fetchInventory.bind(this));
        http.post('/link', this._linkTelegram.bind(this));
    }

    async _getSigninKey(req, res) {
        let tgUser = req.body.userId;
        try {
            let token = uuidv4();
            await this._db.collection(Collections.TelegramAccounts).updateOne({ tgUser: tgUser }, {
                $set: { linkToken: token }
            }, { upsert: true });

            res.json({ token });
        } catch (exc) {
            console.log(exc);
            res.status(500).end();
        }
    }

    async _giveItem(req, res) {
        console.log(req.body);
        // check if such item exist
        let itemId = BotGiveawayWhitelist[req.body.itemId];
        console.log("itemId", itemId);
        if (!itemId) {
            res.status(500).end("unknown item");
            return;
        }

        let itemTemplate = await this._db.collection(Collections.Items).findOne({
            _id: itemId
        });

        console.log("itemTemplate", itemTemplate);

        if (!itemTemplate) {
            res.status(500).end("unknown item");
            return;
        }

        let user = await Game.loadUser(req.body.user);
        await user.loadInventory();
        user.inventory.addItemTemplates({ itemId: 1 });
        await user.commitChanges();

        // send item's image url for the telegram bot
        res.json({
            image: `${itemTemplate.icon}.png`,
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
            items: items
        }

        res.json(summary);
    }

    async _linkTelegram(req, res) {
        let tgUser = req.body.user * 1;
        let linkedAccount = await this._db.collection(Collections.TelegramAccounts).findOne({ tgUser: tgUser });

        if (!linkedAccount) {
            res.status(500).end("incorrect sign in link");
            return;
        }

        if (linkedAccount.linked) {
            res.status(500).end("linked");
            return;
        }

        let walletAddress = req.body.address;
        let signature = req.body.signature;

        let result = await this._signVerifier.verifySign(`${linkedAccount.linkToken}${tgUser}`, signature, walletAddress);
        if (result) {
            // give welcome loot
            let user = await Game.loadUser(walletAddress);

            user.addSoftCurrency(WelcomeGifts.softCurrency);
            await user.loadInventory();
            user.inventory.addItemTemplates(WelcomeGifts.items);

            await user.commitChanges();

            await this._db.collection(Collections.TelegramAccounts).updateOne({ tgUser: tgUser }, {
                $set: { linked: true },
                $unset: { linkToken: "" }
            });

            res.json(WelcomeGifts);
        } else {
            res.status(500).end("failed sign verification");
        }
    }
};

module.exports = Giveaway;