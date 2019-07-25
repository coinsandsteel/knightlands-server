const User = require("./user");
const Random = require("./random");
const Operations = require("./knightlands-shared/operations");
import CharacterStats from "./knightlands-shared/character_stat";
const Unit = require("./combat/unit");
const TronWeb = require("tronweb");
const LootGenerator = require("./lootGenerator");

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: 'da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0'
});

const {
    Collections
} = require("./database");

class PlayerController {
    constructor(socket, db, lootGenerator) {
        this._socket = socket;
        this._db = db;
        this._lootGenerator = lootGenerator;

        // admin functions
        this._socket.on(Operations.GetQuestData, this._getQuestData.bind(this));

        // service functions
        this._socket.on(Operations.Auth, this._handleAuth.bind(this));
        this._socket.on(Operations.GetUserInfo, this._handleGetUserInfo.bind(this));

        // game functions
        this._socket.on(Operations.EngageQuest, this._gameHandler(this._engageQuest.bind(this)));
        this._socket.on(Operations.AttackQuestBoss, this._gameHandler(this._attackQuestBoss.bind(this)));
        this._socket.on(Operations.ResetZone, this._gameHandler(this._resetZone.bind(this)));
        this._socket.on(Operations.EquipItem, this._gameHandler(this._equipItem.bind(this)));
        this._socket.on(Operations.UnequipItem, this._gameHandler(this._unequipItem.bind(this)));
        this._socket.on(Operations.BuyStat, this._gameHandler(this._buyStat.bind(this)));
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
            let nonce = await user.generateNonce();
            respond(null, nonce);
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
                    throw "sign verifiction failed";
                }
            } catch (exc) {
                console.log(exc);
                respond("access denied");
            }
        }
    }

    async _handleGetUserInfo(data, respond) {
        let user = await this._loadUser(this.address);
        let response = user.serializeForClient();
        response.inventory = await user.loadInventory();
        respond(null, response);
    }

    async getExpTable() {
        let table = await this._db.collection(Collections.ExpTable).findOne({
            _id: 1
        });
        return table.table;
    }

    async _loadUser(address) {
        let expTable = await this.getExpTable();
        let user = new User(address, this._db, expTable);

        await user.load();

        return user;
    }


    async _getQuestData(_, respond) {
        let zones = await this._db.collection(Collections.Zones).find({}).toArray();
        respond(null, zones);
    }

    _gameHandler(handler) {
        return async (data, respond) => {
            let user = await this._loadUser(this.address);

            try {
                await handler(user, data);
                let changes = await user.commitChanges();

                respond(null, changes);
            } catch (error) {
                console.log(error);
                respond(error);
            }
        }
    }

    async _engageQuest(user, data) {
        if (!Number.isInteger(data.stage)) {
            throw "missing zone stage";
        }

        if (!Number.isInteger(data.zone)) {
            throw "missing zone";
        }

        if (!Number.isInteger(data.questIndex)) {
            throw "missin quest index";
        }

        const zones = this._db.collection(Collections.Zones);
        let zone = await zones.findOne({
            _id: data.zone
        });

        if (!zone) {
            throw "incorrect zone";
        }

        if (zone.quests.length <= data.questIndex) {
            throw "incorrect quest";
        }

        // quests exists?
        let quest = zone.quests[data.questIndex];

        if (!quest) {
            throw "incorrect quest";
        }

        let isBoss = quest.boss;
        quest = quest.stages[data.stage];

        if (!quest) {
            throw "incorrect stage";
        }

        // check if previous zone was completed on the same stage
        let previousZone = await zones.findOne({
            _id: data.zone - 1
        });

        if (previousZone && !user.isZoneCompleted(previousZone._id, data.stage)) {
            throw "complete previous zone";
        }

        if (isBoss) {
            let bossProgress = user.getQuestBossProgress(zone._id, data.stage);

            if (!bossProgress.unlocked) {
                throw "not allowed";
            }

            if (!user.enoughHp) {
                throw "not enough health";
            }

            let bossData = quest;
            let unitStats = {};
            unitStats[CharacterStats.Health] = bossData.health - bossProgress.damageRecieved;
            unitStats[CharacterStats.Attack] = bossData.attack;
            unitStats[CharacterStats.Defense] = bossData.defense;
            let bossUnit = new Unit(unitStats, bossData);

            let playerUnit = user.getCombatUnit();

            while (user.enoughHp && bossUnit.isAlive) {
                // exp and gold are calculated based on damage inflicted
                let playerDamageDealt = playerUnit.attack(bossUnit);
                bossUnit.attack(playerUnit);

                bossProgress.exp += bossData.exp * (playerDamageDealt / bossUnit.getMaxHealth());
                let expGained = Math.floor(bossProgress.exp);
                bossProgress.exp -= expGained;
                user.addExperience(expGained);

                bossProgress.gold += Random.range(bossData.goldMin, bossData.goldMax) * (playerDamageDealt / bossUnit.getMaxHealth());
                let softCurrencyGained = Math.floor(bossProgress.gold);
                bossProgress.gold -= softCurrencyGained;
                user.addSoftCurrency(softCurrencyGained);

                // if just 1 hit 
                if (data.max !== true) {
                    break;
                }
            }

            // override to save in database
            bossProgress.damageRecieved = bossUnit.getMaxHealth() - bossUnit.getHealth();
            if (bossProgress.damageRecieved > bossUnit.getMaxHealth()) {
                bossProgress.damageRecieved = bossUnit.getMaxHealth();
            }

            if (!bossUnit.isAlive) {
                user.setZoneCompletedFirstTime(data.zone, data.stage);

                let lootGenerator = new LootGenerator(this._db);
                let items = await lootGenerator.getQuestLoot(data.zone, data.questIndex, data.stage, data.stage + 1);

                if (items) {
                    await user.addLoot(items);
                }
            }
        } else {
            // get saved progress or create default
            let questProgress = user.getQuestProgress(data.zone, data.questIndex, data.stage);
            if (!questProgress) {
                throw "not allowed to engage";
            }

            // quest is still not complete?
            if (questProgress.hits >= quest.hits) {
                throw "quest is finished";
            }

            // calculate hits
            let hits = 1;
            if (data.max) {
                hits = quest.hits - questProgress.hits;
            }

            let energyLeft = user.getTimerValue(CharacterStats.Energy);
            // make sure user has enough energy
            if (quest.energy > energyLeft) {
                throw "not enough energy";
            }

            let energyRequired = hits * quest.energy;
            // if user asks for more than 1 hit and doesn't have enough energy - let him perform as many hits as energy allows
            if (energyLeft < energyRequired) {
                hits = Math.floor(energyLeft / quest.energy);
                energyRequired = hits * quest.energy;
            }

            questProgress.hits += hits;

            user.modifyTimerValue(CharacterStats.Energy, -energyRequired);

            let softCurrencyGained = 0;

            let lootGenerator = new LootGenerator(this._db);
            let items = await lootGenerator.getQuestLoot(data.zone, data.questIndex, data.stage, hits);

            if (items) {
                await user.addLoot(items);
            }

            while (hits-- > 0) {
                user.addExperience(quest.exp);
                softCurrencyGained += Math.floor(Random.range(quest.goldMin, quest.goldMax));
            }

            user.addSoftCurrency(softCurrencyGained);

            // check if all previous quests are finished
            let allQuestsFinished = true;
            for (let index = 0; index < zone.quests.length; index++) {
                const quest = zone.quests[index];
                let questProgress = user.getQuestProgress(data.zone, data.questIndex, data.stage);
                if (!questProgress || questProgress.hits < quest.stages[data.stage].hits) {
                    allQuestsFinished = false;
                    break;
                }
            }

            if (allQuestsFinished) {
                // unlock final boss
                let bossProgress = user.getQuestBossProgress(data.zone, data.stage);
                bossProgress.unlocked = true;
            }
        }

        return null;
    }

    async _attackQuestBoss(user, data) {
        if (!Number.isInteger(data.stage)) {
            throw "missing zone stage";
        }

        let zones = this._db.collection(Collections.Zones);
        let zone = await zones.findOne({
            _id: data.zone
        });

        if (!zone) {
            throw "incorrect zone";
        }

        // check if player has enough stamina for requested hits
        let staminaRequired = data.hits;
        if (user.getTimerValue(CharacterStats.Stamina) < staminaRequired) {
            throw "not enough stamina";
        }

        user.modifyTimerValue(CharacterStats.Stamina, -staminaRequired);


        // // quest boss exp and gold is based on
        // user.addExperience(quest.exp);
        // let softCurrencyGained = Math.floor((quest.minGold + Math.random() * (quest.maxGold - quest.minGold)));
        // user.updateProgress(questId, data.stage, 1);

        // user.addSoftCurrency(softCurrencyGained);

        return null;
    }

    async _buyStat(user, data) {
        await user.trainStats(data);
    }

    async _equipItem(user, data) {
        await user.equipItem(data.itemId);
    }

    async _unequipItem(user, data) {
        await user.unequipItem(data.slot);
    }

    async _resetZone(user, data) {
        if (!Number.isInteger(data.stage)) {
            throw "missing zone stage";
        }

        if (!Number.isInteger(data.zone)) {
            throw "missing zone";
        }

        let zones = this._db.collection(Collections.Zones);
        let zone = await zones.findOne({
            _id: data.zone
        });

        if (!zone) {
            throw "incorrect zone";
        }

        if (!user.resetZoneProgress(zone, data.stage)) {
            throw "already reset";
        }

        return null;
    }
}

module.exports = PlayerController;