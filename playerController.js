'use strict';

const Random = require("./random");
const Operations = require("./knightlands-shared/operations");
const Events = require("./knightlands-shared/events");
import CharacterStats from "./knightlands-shared/character_stat";
const Unit = require("./combat/unit");
const IPaymentListener = require("./payment/IPaymentListener");

const Inventory = require("./inventory");

const {
    Collections
} = require("./database");

import Game from "./game";

class PlayerController extends IPaymentListener {
    constructor(socket) {
        super();

        this._socket = socket;
        this._db = Game.db;
        this._raidManager = Game.raidManager;
        this._lootGenerator = Game.lootGenerator;
        this._signVerifier = Game.blockchain;

        // admin functions
        this._socket.on(Operations.GetQuestData, this._getQuestData.bind(this));

        // service functions
        this._socket.on(Operations.Auth, this._handleAuth.bind(this));
        this._socket.on(Operations.GetUserInfo, this._handleGetUserInfo.bind(this));
        this._socket.on(Operations.FetchRaidInfo, this._fetchRaid.bind(this));
        this._socket.on(Operations.FetchRaidSummonStatus, this._fetchRaidSummonStatus.bind(this))
        this._socket.on(Operations.GetCurrencyConversionRate, this._getCurrencyConversionRate.bind(this))
        this._socket.on(Operations.FetchRaidsList, this._fetchRaidsList.bind(this))

        // payed functions 
        this._socket.on(Operations.SendPayment, this._acceptPayment.bind(this));
        this._socket.on(Operations.SummonRaid, this._summonRaid.bind(this));

        // game functions
        this._socket.on(Operations.EngageQuest, this._gameHandler(this._engageQuest.bind(this)));
        this._socket.on(Operations.AttackQuestBoss, this._gameHandler(this._attackQuestBoss.bind(this)));
        this._socket.on(Operations.ResetZone, this._gameHandler(this._resetZone.bind(this)));
        this._socket.on(Operations.EquipItem, this._gameHandler(this._equipItem.bind(this)));
        this._socket.on(Operations.UnequipItem, this._gameHandler(this._unequipItem.bind(this)));
        this._socket.on(Operations.BuyStat, this._gameHandler(this._buyStat.bind(this)));
        this._socket.on(Operations.JoinRaid, this._gameHandler(this._joinRaid.bind(this)));
        this._socket.on(Operations.RefillTimer, this._gameHandler(this._refillTimer.bind(this)));
    }

    get address() {
        return this._socket.authToken ? this._socket.authToken.address : undefined;
    }

    onDisconnect() {
        Game.removeAllListeners(this.address);
        console.log(`player ${this.address} is disconnected`);
    }

    onAuthenticated() {
        Game.on(this.address, this._handleEvent.bind(this));
    }

    async onPayment(iap, eventToTrigger, context) {
        console.log("on payment succeed", JSON.stringify({ iap, eventToTrigger, context }, null, 2));
        this._socket.emit(eventToTrigger, {
            iap,
            context
        });
    }

    async onPaymentFailed(iap, eventToTrigger, reason, context) {
        console.log("on payment failed", JSON.stringify({ iap, eventToTrigger, reason, context }, null, 2));
        this._socket.emit(eventToTrigger, {
            iap,
            reason,
            context
        });
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

        let user = await this.getUser(data.address);

        // if no signed message - generate new nonce and return it back to client
        if (!data.message) {
            let nonce = await user.generateNonce();
            respond(null, nonce);
        } else {
            // if signed message is presented - verify message
            try {
                let result = await this._signVerifier.verifySign(user.nonce, data.message, user.address);
                if (result) {
                    this._socket.setAuthToken({
                        address: user.address,
                        nonce: user.nonce
                    });

                    respond(null, "success");
                } else {
                    throw "verification failed";
                }
            } catch (exc) {
                console.log(exc);
                respond("access denied");
            }
        }
    }

    _handleEvent(event, args) {
        switch (event) {
            case Inventory.Changed:
                this._socket.emit(Events.InventoryUpdate, args);
                break;
        }
    }

    async _handleGetUserInfo(data, respond) {
        let user = await this.getUser(this.address);
        let response = user.serializeForClient();
        response.inventory = await user.loadInventory();
        respond(null, response);
    }



    async getUser() {
        return await Game.loadUser(this.address);
    }

    async _getCurrencyConversionRate(_, respond) {
        respond(null, {
            rate: Game.currencyConversionService.conversionRate
        });
    }

    async _getQuestData(_, respond) {
        let zones = await this._db.collection(Collections.Zones).find({}).toArray();
        respond(null, zones);
    }

    _gameHandler(handler, responseTransformation) {
        return async (data, respond) => {
            let user = await this.getUser(this.address);

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

        let itemsToDrop = 0;

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
                await user.addExperience(expGained);

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
                itemsToDrop = data.stage + 1;
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
            itemsToDrop = hits;

            user.modifyTimerValue(CharacterStats.Energy, -energyRequired);

            let softCurrencyGained = 0;

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

        if (itemsToDrop > 0) {
            let items = await this._lootGenerator.getQuestLoot(data.zone, data.questIndex, data.stage, itemsToDrop);

            if (items) {
                await user.addLoot(items);
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

    async _refillTimer(user, data) {
        // data.stat - type of the timer to refill
        // data.refillType 
        //     0 - Native currency
        //     1 - Shinies
        //     2 - Items
        // In case of items we also need data.items - array of itemIds to use and count

        let {
            stat,
            refillType,
            items
        } = data;

        if (!stat && !refillType) {
            throw "wrong arguments";
        }

        if (!Number.isInteger(refillType)) {
            throw "wrong arguments";
        }

        let timer = user.getTimer(stat);
        if (!timer) {
            throw "wrong stat";
        }

        switch (refillType) {
            case 0:
                // native currency
                break;
            case 1:
                // shinies
                break;

            case 2:
                //items

                break;
        }

        user.setTimerValue(stat, user.getMaxStatValue(stat));

        return null;
    }

    async _acceptPayment(data, respond) {
        try {
            await Game.paymentProcessor.acceptPayment(this.address, data.paymentId, data.signedTransaction);
            respond(null);
        } catch (exc) {
            respond(exc);
        }
    }

    // Raids
    async _fetchRaidSummonStatus(data, respond) {
        let summonStatus = await this._raidManager.getSummonStatus(this.address, data.raid, data.stage);
        respond(null, summonStatus);
    }

    async _fetchRaid(data, respond) {
        let raidInfo = await this._raidManager.getRaidInfo(data.raidId);

        respond(null, raidInfo);
    }

    async _fetchRaidsList(_, respond) {
        let raids = await this._raidManager.getUnfinishedRaids(this.address);
        respond(null, raids);
    }

    async _summonRaid(data, respond) {
        let user = await this.getUser(this.address);

        try {
            let payment = await this._raidManager.summonRaid(user, data.stage, data.raid);
            respond(null, payment);
        } catch (exc) {
            console.log(exc);
            respond(exc);
        }
    }

    async _joinRaid(data, respond) {

    }
}

module.exports = PlayerController;