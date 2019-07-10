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

        // player functions
        this._socket.on(Operations.Auth, this._handleAuth.bind(this));
        this._socket.on(Operations.GetUserInfo, this._handleGetUserInfo.bind(this));
        this._socket.on(Operations.EngageQuest, this._engageQuest.bind(this));
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

    async _engageQuest(data, respond) {
        let quests = this._db.collection(Collections.Quests);

        // quests exists?
        let quest = await quests.findOne({
            _id: data.questId
        });

        if (!quest) {
            respond("no such quest");
            return;
        }

        let user = await this._loadUser(this.address);

        // get saved progress or create default
        let questProgress = user.getQuestProgress(quest._id);

        // quest is still not complete?
        if (questProgress.hits >= quest.hits) {
            respond("quest is finished");
            return;
        }

        // calculate hits
        let hits = 1;
        if (data.max) {
            hits = quest.hits - questProgress.hits;
        }

        user.updateProgress(quest._id, hits);

        // make sure user has enough energy 
        let energyRequired = hits * quest.energy;
        if (energyRequired > user.getTimerValue(CharacterStats.Energy)) {
            respond("not enough energy");
            return;
        }

        // remove energy, and assign exp with gold
        user.modifyTimerValue(CharacterStats.Energy, energyRequired);
        user.addExperience(hits * quest.exp);

        // gold is randomized in 20% range
        const randRange = 0.2;
        let minGold = quest.gold * (1 - randRange);
        let maxGold = quest.gold * (1 + randRange);
        let softCurrencyGained = 0;

        while (hits-- > 0) {
            softCurrencyGained += Math.floor((minGold + Math.random() * (maxGold - minGold)));
            // TODO roll items
        }

        user.addSoftCurrency(softCurrencyGained);

        let result = {
            energy: user.getTimerValue(CharacterStats.Energy),
            exp: user.exp,
            level: user.level,
            softCurrency: user.softCurrency
        };

        // save
        // await user.saveAfterQuest(quest._id);

        respond(null, result);
    }
}

module.exports = PlayerController;