const User = require("./user");
const Operations = require("./knightlands-shared/operations");
const CharacterStats = require("./knightlands-shared/character_stat");

const TronWeb = require('tronweb')

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: 'da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0'
});

const Collections = {
    Users: "users",
    Zones: "zones",
    Quests: "quests"
};

class PlayerController {
    constructor(socket, db) {
        this._socket = socket
        this._db = db

        // admin functions
        this._socket.on(Operations.GetQuestData, this._getQuestData.bind(this));
        this._socket.on("set-zones", this._setZones.bind(this));
        this._socket.on("set-quests", this._setQuests.bind(this));

        // service functions
        this._socket.on(Operations.Auth, this._handleAuth.bind(this));
        this._socket.on(Operations.GetUserInfo, this._handleGetUserInfo.bind(this));

        // game functions
        this._socket.on(Operations.EngageQuest, this._gameHandler(this._engageQuest.bind(this)));
        this._socket.on(Operations.ApplyStats, this._gameHandler(this._applyStats.bind(this)));
        this._socket.on(Operations.ResetStat, this._gameHandler(this._resetStats.bind(this)));
    }

    get address() {
        return this._socket.authToken ? this._socket.authToken.address : "";
    }

    async _handleAuth(data, respond) {
        if (this._socket.authToken) {
            respond("authenticated");
            return;
        }

        if (!data.address) {
            respond("address is required");
            return;
        }

        let user = await this._loadUser(data.address);

        // if no signed message - generate new nonce and return it back to client
        if (!data.message) {
            await user.generateNewNonce();
            respond(null, user.nonce);
        } else {
            // if signed message is presented - verify message
            try {
                let result = await tronWeb.trx.verifyMessage(tronWeb.toHex(user.nonce), data.message, user.address);
                if (result) {
                    this._socket.setAuthToken({
                        address: user.address,
                        nonce: user.nonce
                    });

                    respond(null, "success");
                } else {
                    throw new Exception();
                }
            } catch (exc) {
                console.log(exc);
                respond("access denied");
            }
        }
    }

    async _handleGetUserInfo(data, respond) {
        let user = await this._loadUser(this.address);
        respond(null, user.serializeForClient());
    }

    async _loadUser(address) {
        let user = new User(address, this._db);
        return await user.load();
    }


    async _getQuestData(data, respond) {
        let zones = await this._db.collection(Collections.Zones).find({}).toArray();
        let quests = await this._db.collection(Collections.Quests).find({}).toArray();
        respond(null, {
            zones,
            quests
        });
    }

    async _setZones(data, respond) {
        let col = this._db.collection(Collections.Zones);
        data.zones.forEach(async zone => {
            await col.updateOne({
                _id: zone.zone
            }, {
                $set: zone
            }, {
                upsert: true
            });
        });

        respond();
    }

    async _setQuests(data, respond) {
        let col = this._db.collection(Collections.Quests);

        data.quests.forEach(async quest => {
            await col.updateOne({
                _id: quest.level
            }, {
                $set: quest
            }, {
                upsert: true
            });
        });

        respond();
    }

    _gameHandler(handler) {
        return async (data, respond) => {
            let user = await this._loadUser(this.address);

            let error = await handler(user, data);
            if (error) {
                respond(error);
                return;
            }

            let changes = await user.commitChanges();

            respond(null, changes);
        }
    }

    async _engageQuest(user, data) {
        let quests = this._db.collection(Collections.Quests);

        // quests exists?
        let quest = await quests.findOne({
            _id: data.questId
        });

        if (!quest) {
            return "no such quest";
        }

        // get saved progress or create default
        let questProgress = user.getQuestProgress(quest._id);

        // quest is still not complete?
        if (questProgress.hits >= quest.hits) {
            return "quest is finished";
        }

        // calculate hits
        let hits = 1;
        if (data.max) {
            hits = quest.hits - questProgress.hits;
        }

        user.updateProgress(quest._id, hits);

        // gold is randomized in 20% range
        const randRange = 0.2;
        let minGold = quest.gold * (1 - randRange);
        let maxGold = quest.gold * (1 + randRange);
        let softCurrencyGained = 0;

        while (hits-- > 0) {
            // make sure user has enough energy 
            if (quest.energy > user.getTimerValue(CharacterStats.Energy)) {
                return "not enough energy";
            }

            user.modifyTimerValue(CharacterStats.Energy, -quest.energy);
            user.addExperience(quest.exp);
            softCurrencyGained += Math.floor((minGold + Math.random() * (maxGold - minGold)));
            // TODO roll items
        }

        user.addSoftCurrency(softCurrencyGained);

        return null;
    }

    async _applyStats(user, data) {
        return user.applyStats(data);
    }

    async _resetStats(user, data) {
        return user.resetStats();
    }
}

module.exports = PlayerController;