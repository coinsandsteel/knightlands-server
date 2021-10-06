'use strict';

import CharacterStats from "./knightlands-shared/character_stat";

import CharacterStat, {
    StatConversions,
    DefaultStats
}
from "./knightlands-shared/character_stat";

import TrainingCamp from "./knightlands-shared/training_camp";
import ItemStatResolver from "./knightlands-shared/item_stat_resolver";
import CurrencyType from "./knightlands-shared/currency_type";
import Game from "./game";
import Buffs from "./knightlands-shared/buffs";
import Errors from "./knightlands-shared/errors";
import Events from "./knightlands-shared/events";
import ItemProperties from "./knightlands-shared/item_properties";
import AccessoryOption from "./knightlands-shared/accessory_option";
import { RaidPoints } from "./raids/RaidPoints"
import Random from "./random";
import TrialType from "./knightlands-shared/trial_type";
import RankingType from "./knightlands-shared/ranking_type";
import { GoldMines } from './gold-mines/GoldMines';
import { Dividends } from "./dividends/Dividends.new";
import { DailyShop } from "./shop/DailyShop";
import { PresaleCards } from "./shop/PresaleCards";
import { isNumber } from "./validation";
import { ObjectId } from "mongodb";
import { DividendsRegistry } from "./dividends/DividendsRegistry";
import { RaceShopUser } from "./rankings/Races/RaceShopUser";

const {
    EquipmentSlots,
    getSlot
} = require("./knightlands-shared/equipment_slot");

const ItemType = require("./knightlands-shared/item_type");

const Trials = require("./Trials/Trials");
const uuidv4 = require('uuid/v4');
const cloneDeep = require('lodash.clonedeep');
const PlayerUnit = require("./combat/playerUnit");
const TowerPlayerUnit = require("./combat/towerPlayerUnit");
const Inventory = require("./inventory");
const Crafting = require("./crafting/crafting");
const DailyQuests = require("./dailyQuests");
const ItemActions = require("./knightlands-shared/item_actions");
const Config = require("./config");

const DefaultRegenTimeSeconds = 120;
const TimerRefillReset = 86400000;
const AdventureRefreshInterval = 86400000;
const BeastMaxBoost = 50;

const {
    Collections,
    buildUpdateQuery
} = require("./database/database");

function extraStatIfItemOwned(property, count, finalStats) {
    count = property.maxItemCount < count ? property.maxItemCount : count;
    finalStats[property.stat] += property.value * count;
}

class User {
    constructor(address, db, expTable, meta) {
        this.FullInventoryChanges = 1;
        this.DeltaInventoryChanges = 2;

        this._address = address;
        this._expTable = expTable;
        this._meta = meta;
        this._recalculateStats = false;
        this._combatUnit = null;
        this._buffsResolver = new Buffs();
    }

    dispose() {
        clearTimeout(this._buffUpdateTimeout);
    }

    serializeForClient() {
        // we can use shallow copy here, we delete only first level fields
        let data = Object.assign({}, this._data);
        // remove unwanted fields
        delete data.nonce;
        // delete data.address;

        data.depositorId = this.depositorId;

        return data;
    }

    get id() {
        return this._data._id;
    }

    get nonce() {
        return this._data.nonce;
    }

    get exp() {
        return this._data.character.exp;
    }

    get level() {
        return this._data.character.level;
    }

    get softCurrency() {
        return this._inventory.getCurrency(CurrencyType.Soft);
    }

    get hardCurrency() {
        return this._inventory.getCurrency(CurrencyType.Hard);
    }

    get dkt() {
        return this._inventory.getCurrency(CurrencyType.Dkt);
    }

    get stakedDkt() {
        return this._inventory.getCurrency(CurrencyType.StakedDkt);
    }

    get address() {
        return this._address;
    }

    get enoughHp() {
        return this.getTimerValue(CharacterStats.Health) > 0;
    }

    get inventory() {
        return this._inventory;
    }

    get crafting() {
        return this._crafting;
    }

    get raidTickets() {
        return this._data.raidTickets;
    }

    get rank() {
        return this._data.rank.index;
    }

    get towerFloorsCleared() {
        return this._data.tower.towerFloorsCleared;
    }

    set towerFloorsCleared(value) {
        this._data.tower.towerFloorsCleared = value;
    }

    get towerPurchased() {
        return this._data.tower.purchased;
    }

    set towerPurchased(value) {
        return this._data.tower.purchased = value;
    }

    get freeTowerAttempts() {
        return this._data.tower.freeAttemps;
    }

    set freeTowerAttempts(value) {
        this._data.tower.freeAttemps = value;
    }

    get challengedTowerFloor() {
        return this._data.tower.challengedFloor;
    }

    get maxStats() {
        return this._data.character.stats;
    }

    get goldExchange() {
        return this._goldExchange;
    }

    get dailyQuests() {
        return this._dailyQuests;
    }

    get equipment() {
        return this._data.character.equipment;
    }

    get goldMines() {
        return this._goldMines;
    }

    get dividends() {
        return this._dividends;
    }

    get dailyShop() {
        return this._dailyShop;
    }

    get subscriptions() {
        return this._data.subscriptions;
    }

    get cards() {
        return this.subscriptions.cards;
    }

    get nickname() {
        return this._data.character.name;
    }

    set nickname(value) {
        this._data.character.name = value;
    }

    set avatar(value) {
        this._data.character.avatar = value;
    }

    get isFreeAccount() {
        return !this._data.accountType;
    }

    hasFlag(flag) {
        return !!this._data.flags[flag];
    }

    setFlag(flag, value) {
        if (!this._data.flags) {
            this._data.flags = {};
        }
        this._data.flags[flag] = value;
    }


    async upgradeAccount() {
        let activeRaidsCount = await Game.raidManager.activeRaidsCount(this.id);
        if (activeRaidsCount) {
            return;
        }

        this._data.accountType = !this._data.accountType;
        this.raidPoints.reset();
    }

    async getMeta(id) {
        if (!this._meta) {
            this._meta = {};
        }

        if (!this._meta[id]) {
            this._meta[id] = await Game.db.collection(Collections.Meta).findOne({ _id: id });
        }

        return this._meta[id];
    }

    async getWeaponCombatData() {
        let weapon = this.equipment[EquipmentSlots.MainHand];
        if (!weapon) {
            return null;
        }

        let item = this.inventory.getItemById(weapon.id);
        let template = await Game.itemTemplates.getTemplate(item.template);
        return {
            element: item.element,
            type: template.equipmentType
        }
    }

    getCombatUnit(config) {
        let stats = {...this.maxStats };
        if (config && config.raid) {
            this._buffsResolver.calculate(Game.now, this.rawStats, this._data.character.buffs, config.raid);
            stats = this._buffsResolver.finalStats;
        }

        const maxStats = {...stats };

        stats[CharacterStat.Energy] = this.getTimerValue(CharacterStats.Energy);
        stats[CharacterStat.Stamina] = this.getTimerValue(CharacterStats.Stamina);
        stats[CharacterStat.Health] = this.getTimerValue(CharacterStats.Health);

        return new PlayerUnit(this, stats, maxStats);
    }

    async addSoftCurrency(value, ignorePassiveBonuses = false) {
        if (value > 0 && !ignorePassiveBonuses) {
            value *= (1 + this.getMaxStatValue(CharacterStat.ExtraGold) / 1000);

            const bonuses = await this.getCardBonuses();
            value *= (1 + bonuses.soft / 100);
        }

        value = Math.floor(value);

        await this._inventory.modifyCurrency(CurrencyType.Soft, value);

        return value;
    }

    async addHardCurrency(value) {
        const order = Math.pow(10, 6);
        value = Math.floor(value * order) / order;
        await this._inventory.modifyCurrency(CurrencyType.Hard, value);
        return value;
    }

    async addRP(value) {
        await this.raidPoints.addPoints(value);
    }

    async getBonusRP(value) {
        if (value > 0) {
            value *= (1 + this.getMaxStatValue(CharacterStat.ExtraDkt) / 1000);
            value = await this.dividends.applyBonusDkt(value);

            const bonuses = await this.getCardBonuses();
            value *= (1 + bonuses.dkt / 100);
        }

        return value;
    }

    async addDkt(value, noRankings = fase) {
        value = Math.floor(value * DividendsRegistry.DktDecimals) / DividendsRegistry.DktDecimals;

        // if payout day is shifted, commit previous days balance
        await this.dividends.tryCommitPayout();
        await this.inventory.modifyCurrency(CurrencyType.Dkt, value, noRankings);
    }

    getChests() {
        return this._data.chests;
    }

    setChestFreeOpening(chest) {
        this._data.chests[chest] = Game.now;
    }

    async addExperience(exp, ignoreBonus = false) {
        const maxLevels = this._expTable.length;
        const character = this._data.character;

        if (character.level >= maxLevels) {
            return exp;
        }

        let totalExp = exp;

        if (!ignoreBonus) {
            totalExp *= (1 + this.getMaxStatValue(CharacterStat.ExtraExp) / 1000);

            const bonuses = await this.getCardBonuses();
            totalExp *= (1 + bonuses.exp / 100);

            totalExp = Math.floor(totalExp);
        }
        character.exp += totalExp;

        const previousLevel = character.level;
        while (character.level < maxLevels) {
            let toNextLevel = this._expTable[character.level];
            if (toNextLevel <= character.exp) {
                character.level++;
                character.exp -= toNextLevel;
            } else {
                break;
            }
        }

        if (previousLevel < character.level) {
            let levelUpMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "levelUp" });

            for (let i = previousLevel; i < character.level; ++i) {
                // assign currencies
                let levelMeta = levelUpMeta.records[i];
                if (levelMeta) {
                    await this.addSoftCurrency(levelMeta.soft, true);
                    await this.addHardCurrency(levelMeta.hard);
                }
            }

            await this.airDropItemsIfAny();

            this._recalculateStats = true;
            this._restoreTimers();
            await this._updateTimersRegen();
        }

        await Game.rankings.updateRank(this.id, {
            type: RankingType.ExpGained
        }, totalExp);

        return totalExp;
    }

    async _updateTimersRegen() {
        const classSelected = await this._loadAndCacheClassData(this._data.character.class);

        if (classSelected) {
            this.getTimer(CharacterStats.Energy).regenTime = classSelected.energyRegen - this.level * 0.4;
            this.getTimer(CharacterStats.Stamina).regenTime = classSelected.staminaRegen - this.level * 0.4;
        }
    }

    _restoreTimers() {
        if (this.getTimerValue(CharacterStats.Energy) < this.getMaxStatValue(CharacterStats.Energy)) {
            this.getTimer(CharacterStats.Energy).value = this.getMaxStatValue(CharacterStats.Energy);
        }

        if (this.getTimerValue(CharacterStats.Stamina) < this.getMaxStatValue(CharacterStats.Stamina)) {
            this.getTimer(CharacterStats.Stamina).value = this.getMaxStatValue(CharacterStats.Stamina);
        }

        if (this.getTimerValue(CharacterStats.Health) < this.getMaxStatValue(CharacterStats.Health)) {
            this.getTimer(CharacterStats.Health).value = this.getMaxStatValue(CharacterStats.Health);
        }
    }

    getTimer(stat) {
        return this._data.character.timers[stat];
    }

    getMaxStatValue(stat) {
        return this.maxStats[stat];
    }

    getTimerValue(stat) {
        this._advanceTimer(stat);
        return this.getTimer(stat).value;
    }

    setTimerValue(stat, value) {
        this._advanceTimer(stat);
        this.getTimer(stat).value = value;
    }

    async modifyTimerValue(stat, value) {
        let timer = this.getTimer(stat);
        if (timer) {
            this._advanceTimer(stat);
            timer.value += value;

            if (timer.value + value > this.getMaxStatValue(stat)) {
                value = 0;
            }

            if (stat == CharacterStat.Energy && value < 0) {
                await Game.rankings.updateRank(this.id, {
                    type: RankingType.EnergySpent
                }, -value);
                await this.dailyQuests.onEnergySpent(-value);
            } else if (stat == CharacterStat.Stamina && value < 0) {
                await Game.rankings.updateRank(this.id, {
                    type: RankingType.StaminaSpent
                }, -value);
            }
        }
    }

    getRefillsCount(stat) {
        let timer = this.getTimer(stat);
        // this.setTimerValue(stat, this.getMaxStatValue(stat));
        let lastRefillTime = timer.lastRefillTime || 0;
        let now = Game.now;
        // let's find out whether timer must be reset
        let timePassed = now - lastRefillTime;
        if (timePassed > TimerRefillReset) {
            // reset refill counter
            timer.refills = 0;
            // update lastRefillTime
            timer.lastRefillTime = now - (timePassed % TimerRefillReset);
        }

        return timer.refills || 0;
    }

    getTimeUntilReset(stat) {
        let timer = this.getTimer(stat);
        let lastRefillTime = timer.lastRefillTime || 0;
        let timePassed = Game.now - lastRefillTime;
        return timePassed % TimerRefillReset;
    }

    async getTimerRefillCost(stat, count) {
        if (stat == CharacterStats.Health) {
            const price = Math.ceil(
                Math.log(this.level) *
                (this.getMaxStatValue(stat) - this.getTimerValue(stat)) * 5 + 100
            );

            return {
                soft: price
            };
        }

        let refillMeta = await this.getMeta("refill");
        let refillsToday = this.getRefillsCount(stat);
        let hard = 0;

        for (let i = 0; i < count; ++i) {
            hard += Math.round(refillMeta.cost.base * Math.pow(i + refillsToday + 1, refillMeta.cost.expScale));
        }

        return {
            hard
        }
    }

    async getRefillAmount(stat, refills) {
        let refillMeta = await this.getMeta("refill");
        if (stat == CharacterStats.Health) {
            return this.getMaxStatValue(stat);
        }

        return this.getTimerValue(stat) + refillMeta[stat][this.level - 1] * refills;
    }

    async refillTimer(stat, refills) {
        let timer = this.getTimer(stat);
        timer.value = await this.getRefillAmount(stat, refills);
        timer.refills = this.getRefillsCount(stat) + refills;
        this._advanceTimer(stat);
    }

    _advanceTimers() {
        for (let i in this._data.character.timers) {
            this._advanceTimer(i);
        }
    }

    _advanceTimer(stat) {
        let now = Game.nowSec;
        let character = this._data.character;
        let timer = this.getTimer(stat);

        if (character.stats[stat] <= timer.value) {
            timer.lastRegenTime = now;
            return;
        }

        let timePassed = now - timer.lastRegenTime;
        let valueRenerated = Math.floor(timePassed / timer.regenTime);

        if (valueRenerated > 0) {
            // adjust regen time to accomodate rounding
            timer.lastRegenTime += valueRenerated * timer.regenTime;

            timer.value += valueRenerated;
            // clamp to max value
            timer.value = character.stats[stat] < timer.value ? character.stats[stat] : timer.value;
            // this._originalData.character.timers[stat] = cloneDeep(timer);
        }
    }

    async generateNonce() {
        this._data.nonce = uuidv4();
        const users = Game.dbClient.db.collection(Collections.Users);
        await users.updateOne({
            address: this._address
        }, {
            $set: {
                nonce: this._data.nonce
            }
        });

        return this._data.nonce;
    }

    async loadInventory() {
        return await this._inventory.loadAllItems();
    }

    async load(id) {
        if (!id && (this._address == undefined || this._address == null)) {
            return;
        }

        const users = Game.dbClient.db.collection(Collections.Users);

        let userData = this._validateUser({
            address: this._address
        });

        let searchQuery = {
            address: this._address
        };

        if (id) {
            searchQuery = {
                _id: new ObjectId(id)
            };
        }

        userData = (await users.findOneAndUpdate(
            searchQuery, {
                $setOnInsert: userData,
                $set: { lastLogin: Game.nowSec }
            }, {
                returnDocument: 'after',
                upsert: true
            }
        )).value;

        this._originalData = cloneDeep(userData);
        this._address = this._originalData.address;

        userData = this._validateUser(userData);

        this._data = userData;
        this._inventory = new Inventory(this, Game.dbClient.db);
        this._crafting = new Crafting(this, this._inventory);
        this._itemStatResolver = new ItemStatResolver(
            this._meta.statConversions,
            this._meta.itemPower,
            this._meta.itemPowerSlotFactors,
            this._meta.charmItemPower
        );
        this._trials = new Trials(this._data.trials, this);
        this._dailyQuests = new DailyQuests(this._data.dailyQuests, this);
        this._goldMines = new GoldMines(this, this._data.goldMines);
        this._dividends = new Dividends(this._data.dividends, this);
        this._dailyShop = new DailyShop(this._data.dailyShop, this);
        this.raidPoints = new RaidPoints(this._data.raidPoints, this);
        this.founderSale = new PresaleCards(this._data.pCards, this);
        this.raceShop = new RaceShopUser(this._data.raceShop, this);

        this._advanceTimers();

        this.depositorId = await Game.depositGateway.createDepositor(this.id);

        await this._inventory.loadAll();
        await this._trials.init();
        await this._dailyQuests.init();
        await this.executeDailyReset();
        await this.raidPoints.tryClaimDkt();
        await this._dividends.tryCommitPayout();
        await this._dailyShop.update();

        let adventuresMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "adventures_meta" });
        this.adventuresList = adventuresMeta.weightedList;

        await this._updateTimersRegen();
        await this.airDropItemsIfAny();

        // calculate stats from items and stats from buffs
        await this._calculateFinalStats(true);
        await this.commitChanges();

        return this;
    }

    getQuestBossProgress(zone, stage) {
        let stages = this._data.questsProgress.bosses[zone];
        if (!stages) {
            stages = {};
            this._data.questsProgress.bosses[zone] = stages;
        }

        let progress = stages[stage];
        if (!progress) {
            progress = {
                damageRecieved: 0,
                gold: 0,
                exp: 0,
                unlocked: false
            };
            stages[stage] = progress;
        }

        return progress;
    }

    isZoneCompleted(zone, stage) {
        if (!this._data.questsProgress.completedRecords[zone]) {
            this._data.questsProgress.completedRecords[zone] = {};
        }

        return this._data.questsProgress.completedRecords[zone][stage];
    }

    setZoneCompletedFirstTime(zone, stage) {
        if (!this._data.questsProgress.completedRecords[zone]) {
            this._data.questsProgress.completedRecords[zone] = {};
        }

        this._data.questsProgress.completedRecords[zone][stage] = true;
    }

    resetZoneProgress(zone, stage) {
        let bossProgress = this.getQuestBossProgress(zone._id, stage);
        if (bossProgress.damageRecieved === 0) {
            return false;
        }

        bossProgress.damageRecieved = 0;
        bossProgress.unlocked = false;

        zone.quests.forEach((_, index) => {
            this.getQuestProgress(zone._id, index, stage).hits = 0;
        });

        return true;
    }

    getQuestProgress(zone, questId, stage) {
        let quests = this._data.questsProgress.zones[zone];
        if (!quests) {
            quests = {};
            this._data.questsProgress.zones[zone] = quests;
        }

        let stages = quests[questId];
        if (!stages) {
            stages = {};
            quests[questId] = stages;
        }

        let progress = stages[stage];

        if (!progress) {
            progress = {
                hits: 0
            };
            stages[stage] = progress;
        }

        return progress;
    }

    async trainStats(stats) {
        const trainingMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "training_camp" });
        let totalGoldRequired = 0;

        let resourceRequired = {};
        let resourcesInStock = {};

        for (let i in stats) {
            if (!Number.isInteger(stats[i])) {
                return `incorrect stat ${i}`;
            }

            if (!this._data.character.attributes.hasOwnProperty(i)) {
                return `incorrect stat ${i}`;;
            }

            resourcesInStock[i] = this.inventory.countItemsByTemplate(trainingMeta.stats[i].resource);

            let value = this._data.character.attributes[i];
            const finalValue = this._data.character.attributes[i] + stats[i];

            if (finalValue > TrainingCamp.getMaxStat(this.level)) {
                throw "stat is over max level";
            }

            for (; value < finalValue; value++) {
                totalGoldRequired += TrainingCamp.getStatCost(i, value);
                resourceRequired[i] = (resourceRequired[i] || 0) + TrainingCamp.getStatResourceCost(i, value);
            }

            if (totalGoldRequired > this.softCurrency) {
                throw Errors.NotEnoughSoft;
            }

            if (resourcesInStock[i] < resourceRequired[i]) {
                throw Errors.NotEnoughResource;
            }

            this._data.character.attributes[i] = finalValue;
        }

        if (totalGoldRequired == 0) {
            return;
        }

        if (totalGoldRequired > this.softCurrency) {
            throw Errors.NotEnoughSoft;
        }

        for (let i in resourceRequired) {
            this.inventory.removeItemByTemplate(trainingMeta.stats[i].resource, resourceRequired[i]);
        }

        await this.addSoftCurrency(-totalGoldRequired);
        this._recalculateStats = true;
    }

    async onInventoryChanged({ changes }) {
        // if any item was removed or added, do not trigger on currencies balances
        if (Object.keys(changes).length != 0) {
            await this._calculateFinalStats(true);
        }
    }

    async _calculateFinalStats(force = false) {
        if (!force && !this._recalculateStats) {
            return;
        }

        let finalStats = Object.assign({}, cloneDeep(DefaultStats));
        let character = this._data.character;
        for (let i in character.attributes) {
            finalStats[i] += StatConversions[i] * character.attributes[i];
        }

        let levelUpMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "levelUp" });

        let levelMetaData = levelUpMeta.records[character.level - 1].stats;

        finalStats[CharacterStats.Stamina] += levelMetaData[CharacterStats.Stamina];
        finalStats[CharacterStats.Energy] += levelMetaData[CharacterStats.Energy]
            // finalStats[CharacterStats.Honor] += levelUpMeta[CharacterStats.Energy]
        finalStats[CharacterStats.Health] += levelMetaData[CharacterStats.Health]

        let combatMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "combat_meta" });

        let mainHandType;
        let offHandType;
        let relativeStats = {}

        // calculate stats from equipment
        for (let slotId in character.equipment) {
            let equippedItem = character.equipment[slotId];
            equippedItem = this.inventory.getItemById(equippedItem.id);

            let template = await Game.itemTemplates.getTemplate(equippedItem.template);
            if (!template) {
                continue;
            }

            let slot = getSlot(template.equipmentType);
            if (slot == EquipmentSlots.MainHand) {
                mainHandType = template.equipmentType;
            } else if (slot == EquipmentSlots.OffHand) {
                offHandType = template.equipmentType;
            } else if (slot == EquipmentSlots.Ring || slot == EquipmentSlots.Necklace) {
                this._applyAccessoryProperties(equippedItem, finalStats, relativeStats);
            }

            let stats = this._itemStatResolver.convertStats(template, equippedItem.level, equippedItem.enchant);
            for (let stat in stats) {
                finalStats[stat] += stats[stat];
            }
        }

        if (mainHandType && offHandType) {
            // check if the bonus if applicable
            let mainHandBonus = combatMeta.weaponBonuses[mainHandType];
            if (mainHandBonus.offHand == offHandType) {
                finalStats[CharacterStat.Attack] += Math.floor(finalStats[CharacterStat.Attack] * mainHandBonus.bonus / 100);
            }
        }

        // calculate stats from inventory passive items
        await this._applyInventoryPassives(finalStats);

        // add stats from beast. If it is non upgraded beast, skip it
        if (this._data.beast.index != 0 || this._data.beast.level != 0) {
            const beastsMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "beasts" });
            let level = this._data.beast.level;
            let index = this._data.beast.index;
            if (level == 0) {
                index--;
                level = beastsMeta.levels[index].levels.length;
            }

            const currentBeast = beastsMeta.levels[index].levels[level - 1];
            finalStats[CharacterStat.Health] += currentBeast.health;
            finalStats[CharacterStat.Attack] += currentBeast.attack;
            finalStats[CharacterStat.Defense] += currentBeast.defense;
        }

        // apply relative stats
        for (let stat in relativeStats) {
            finalStats[stat] += Math.floor(finalStats[stat] * relativeStats[stat])
        }

        let oldStats = character.stats;
        this.rawStats = finalStats;

        await Game.prizePool.updateRank(this.id, {
            type: RankingType.CharacterPower
        }, this._itemStatResolver.inverseStats(finalStats));
        await this._recalculateBuffs(false);
        finalStats = character.stats;
    }

    _applyAccessoryProperties(item, finalStats, relativeStats) {
        if (!item.properties || !Array.isArray(item.properties)) {
            return;
        }

        for (const prop of item.properties) {
            const propTemplate = Game.accessoryOptions.getOption(prop.id);
            switch (propTemplate.type) {
                case AccessoryOption.IncreasedStat:
                    relativeStats[propTemplate.stat] = (relativeStats[propTemplate.stat] || 0) + prop.value;
                    break
                case AccessoryOption.ArmyDamageInRaidElement:
                    const byElement = finalStats[CharacterStats.ArmyDamageInRaidElement];
                    if (!byElement[propTemplate.element]) {
                        byElement[propTemplate.element] = 0;
                    }
                    byElement[propTemplate.element] += prop.value;
                    break

                case AccessoryOption.DropItemInQuest:
                    const byItem = finalStats[CharacterStats.DropItemQuest];
                    if (!byItem[propTemplate.itemId]) {
                        byItem[propTemplate.itemId] = 0;
                    }
                    byItem[propTemplate.itemId] += prop.value;
                    break

                case AccessoryOption.GoldOnHitInRaid:
                    finalStats[CharacterStat.GoldOnHitInRaid] += prop.value;
                    break;

                case AccessoryOption.ExpOnHitInRaid:
                    finalStats[CharacterStat.ExpOnHitInRaid] += prop.value;
                    break;

                case AccessoryOption.AddStat:
                    finalStats[propTemplate.stat] += prop.value;
                    break;
            }
        }
    }

    async _recalculateBuffs(update = true) {
        clearTimeout(this._buffUpdateTimeout);

        const buffs = this._data.character.buffs;
        let i = 0;
        const length = buffs.length;
        const now = Game.now;
        let filteredIndex = 0;
        let earliestTime = -1;
        // find earliest buff to finish and filter out finished buffs
        for (; i < length; ++i) {
            const buff = buffs[i];
            const time = buff.duration - (now - buff.applyTime) / 1000;
            if (time <= 0) {
                // buff is finished, skip it
                continue;
            }

            if (earliestTime > time) {
                earliestTime = time;
            }

            buffs[filteredIndex++] = buff;
        }

        if (buffs.length > 0) {
            buffs.splice(filteredIndex);
            await this._saveBuffs();
        }

        if (earliestTime > -1) {
            this._buffUpdateTimeout = setTimeout(this._recalculateBuffs.bind(this), earliestTime);
        }

        this._buffsResolver.calculate(Game.now, this.rawStats, buffs);
        this._data.character.stats = this._buffsResolver.finalStats;

        if (update) {
            Game.emitPlayerEvent(this.address, Events.BuffUpdate, this.maxStats);
        }
    }

    async _applyInventoryPassives(finalStats) {
        let items = await this._inventory.getPassiveItems();
        if (!items) {
            return;
        }

        let i = 0;
        const length = items.length;
        for (; i < length; i++) {
            let item = items[i];

            if (item.type == ItemType.Charm) {
                // apply stats
                let max = item.maxStack;
                if (max > item.count) {
                    max = item.count;
                }

                let stats = this._itemStatResolver.convertStats(item, item.level, 0);
                for (let stat in stats) {
                    finalStats[stat] += stats[stat] * max;
                }
            }

            const props = item.properties;
            let k = 0;
            const pLength = props.length;
            for (; k < pLength; ++k) {
                let prop = props[k];
                if (prop.type == ItemProperties.ExtraStatIfItemNotEquipped) {
                    extraStatIfItemOwned(prop, item.count, finalStats);
                } else if (item.type == ItemType.Charm && prop.type == ItemProperties.ExtraStatIfItemOwned) {
                    extraStatIfItemOwned(prop, item.count, finalStats);
                }
            }
        }
    }

    resetStats() {
        for (let i in this._data.character.attributes) {
            this._data.character.freeAttributePoints += this._data.character.attributes[i];
            this._data.character.attributes[i] = 0;
        }

        return null;
    }

    async addLoot(itemTemplates) {
        return this._inventory.addItemTemplates(itemTemplates);
    }

    async useItem(itemId, count = 1) {
        let itemToUse = this._inventory.getItemById(itemId);
        if (!itemToUse) {
            throw Errors.NoItem;
        }

        let template = await Game.itemTemplates.getTemplate(itemToUse.template);
        if (!template.action) {
            throw Errors.NotConsumable;
        }

        const actionData = template.action;
        if (actionData.minLevel > this.level) {
            throw Errors.NotEnoughLevel;
        }

        let itemsRequired = count;

        if (actionData.required > 0) {
            itemsRequired *= actionData.required;
        }

        if (itemToUse.count < itemsRequired) {
            throw Errors.NoEnoughItems;
        }

        const actionValue = actionData.value * count;
        let actionResult;

        // based on action perform necessary actions
        switch (actionData.action) {
            case ItemActions.RefillTimer:
                if (actionData.relative) {
                    // % restoration from maximum base 
                    await this.modifyTimerValue(actionData.stat, this.getMaxStatValue(actionData.stat) * actionValue / 100);
                } else {
                    await this.modifyTimerValue(actionData.stat, actionValue);
                }
                break;

            case ItemActions.AddExperience:
                await this.addExperience(actionValue, true);
                break;

            case ItemActions.OpenBox:
                if (count > 10) {
                    throw Errors.IncorrectArguments;
                }

                let items = await Game.lootGenerator.getLootFromTable(actionData.lootTable, null, count);
                await this.addLoot(items);
                actionResult = items;
                break;

            case ItemActions.Buff:
            case ItemActions.RaidBuff:
                actionResult = await this._applyBuff(template._id, actionData);
                break;

            case ItemActions.SummonUnit:
                if (count > 10) {
                    throw Errors.IncorrectArguments;
                }
                actionResult = await Game._armyManager.summonRandomUnit(this, count, actionData.value, actionData.summonType);
                break;

            case ItemActions.AddPrizePoints:
                await Game.prizePool.updateRank(this.id, {
                    type: RankingType.CollectedItem,
                    item: itemToUse.template
                }, actionValue)
                break;

            case ItemActions.AddArmySlots:
                await Game.armyManager.expandSlots(this, actionValue)
                break;

            default:
                throw Errors.UnknownAction;
        }

        // remove used item
        this._inventory.removeItem(itemToUse.id, itemsRequired);
        return actionResult;
    }

    async _applyBuff(templateId, actionData) {
        // first fine buff in the array
        let buffs = this._data.character.buffs;

        let currentBuff = buffs.find(x => x.template == templateId);
        if (!currentBuff) {
            // create new 
            currentBuff = {
                template: templateId,
                duration: actionData.duration,
                value: actionData.value,
                raid: actionData.raid || -1,
                relative: actionData.relative,
                stat: actionData.stat
            };

            buffs.push(currentBuff);
        }

        currentBuff.applyTime = Game.now;

        Game.emitPlayerEvent(this.address, Events.BuffApplied, currentBuff);

        await this._recalculateBuffs(false);

        return null;
    }

    async _saveBuffs() {
        await Game.dbClient.db.collection(Collections.Users).updateOne({
            address: this._address
        }, {
            $set: {
                "character.buffs": this._data.character.buffs
            }
        }, { upsert: true });
    }

    async equipItem(itemId) {
        await this._inventory.loadAllItems();

        let itemToEquip = this._inventory.getItemById(itemId);
        if (!itemToEquip) {
            throw Errors.NoItem;
        }

        if (itemToEquip.level > this.level) {
            throw Errors.IncorrectArguments;
        }

        let template = await await Game.itemTemplates.getTemplate(itemToEquip.template);
        if (!template) {
            throw Errors.NoTemplate;
        }

        if (template.type != ItemType.Equipment) {
            throw Errors.NotEquipment;
        }

        await this._inventory.equipItem(itemToEquip, this.equipment);
        this._recalculateStats = true;
    }

    async unequipItem(itemSlot) {
        await this._inventory.loadAllItems();
        await this._inventory.unequipItem(this.equipment[itemSlot].id);
        this._recalculateStats = true;
    }

    async levelUpItem(itemId, materials, count) {
        return await this._crafting.levelUpItem(itemId, materials, count);
    }

    async enchantItem(itemId, currency) {
        return await this._crafting.enchantItem(itemId, currency);
    }

    async unbindItem(itemId, items) {
        return await this._crafting.unbindItem(itemId, items);
    }

    async commitChanges() {
        await this._calculateFinalStats();

        await Game.dbClient.withTransaction(async db => {
            let users = db.collection(Collections.Users);
            let {
                updateQuery,
                removeQuery,
                changes,
                removals
            } = buildUpdateQuery(this._originalData, this._data);

            if (updateQuery || removeQuery) {
                let finalQuery = {};

                if (updateQuery) {
                    finalQuery.$set = updateQuery;
                }

                if (removeQuery) {
                    finalQuery.$unset = removeQuery;
                }

                await users.updateOne({
                    address: this.address
                }, finalQuery, { upsert: true });

                this._originalData = cloneDeep(this._data);
            }

            await this._inventory.commitChanges(db);

            Game.emitPlayerEvent(this.id, Events.CommitChanges, {
                changes,
                removals
            });
        })
    }

    async autoCommitChanges(changeCallback) {
        let response;

        if (changeCallback) {
            try {
                response = await changeCallback(this);
            } catch (exc) {
                console.error(exc);
            }
        }

        await this.commitChanges();

        return response;
    }

    _validateUser(user) {
        if (!user.raceShop) {
            user.raceShop = {};
        }

        if (!user.character) {
            let character = {
                level: 1,
                exp: 0,
                timers: {
                    health: {
                        value: 0,
                        lastRegenTime: 0,
                        regenTime: 5
                    },
                    energy: {
                        value: 0,
                        lastRegenTime: 0,
                        regenTime: DefaultRegenTimeSeconds
                    },
                    stamina: {
                        value: 0,
                        lastRegenTime: 0,
                        regenTime: DefaultRegenTimeSeconds
                    }
                },
                stats: {...cloneDeep(DefaultStats) },
                attributes: {
                    health: 0,
                    attack: 0,
                    defense: 0,
                    luck: 0,
                    energy: 0,
                    stamina: 0
                },
                buffs: [],
                equipment: {},
                name: {
                    v: "",
                    changed: 0
                }
            };

            user.character = character;
        }

        if (!user.tutorial) {
            user.tutorial = {};
        }

        if (!user.questsProgress) {
            user.questsProgress = {
                completedRecords: {}, // keep track of completed quests to unlock next stages
                zones: {}, // zones progress
                bosses: {}
            };
        }

        if (!user.questsProgress.bosses) {
            user.questsProgress.bosses = {};
        }

        if (!user.questsProgress.zones) {
            user.questsProgress.zones = {};
        }

        if (!user.chests) {
            // saves when last free chest was opened
            user.chests = {};
        }

        if (!user.hasOwnProperty("raidTickets")) {
            user.raidTickets = 0;
        }

        if (!user.hasOwnProperty("classInited")) {
            user.classInited = false;
        }

        if (!user.rank) {
            user.rank = {
                index: 0,
                exp: 0
            };
        }

        if (!user.dailyRewardCollect) {
            user.dailyRewardCollect = {
                cycle: 0,
                step: 0
            };
        }

        if (!user.dailyRefillCollect) {
            user.dailyRefillCollect = 0;
        }

        if (!user.dailyShop) {
            user.dailyShop = {};
        }

        if (!user.beast) {
            user.beast = {
                level: 0,
                index: 0,
                exp: 0
            };
        }

        if (!user.tower) {
            user.tower = {
                towerFloorsCleared: 0,
                freeAttemps: 0,
                challengedFloor: {
                    id: 0,
                    startTime: 0,
                    health: 0,
                    attack: 0,
                    claimed: true
                }
            };
        }

        if (!user.trials) {
            user.trials = {};
        }

        if (!user.dailyQuests) {
            user.dailyQuests = {};
        }

        if (!user.goldMines) {
            user.goldMines = {};
        }

        if (!user.dividends) {
            user.dividends = {};
        }

        if (!user.premiumShop) {
            user.premiumShop = {};
        }

        if (!user.subscriptions) {
            user.subscriptions = {
                lastClaimCycle: 0,
                cards: {}
            };
        }

        if (!user.airdrops) {
            user.airdrops = {};
        }

        if (!user.raidPoints) {
            user.raidPoints = {};
        }

        if (user.character.nickname) {
            if (typeof user.character.nickname == "string") {
                user.character.name = {
                    v: user.character.nickname,
                    changed: 0
                }
            }
        }

        if (!user.sRaidAttempts) {
            user.sRaidAttempts = {};
        }

        if (!user.pCards) {
            user.pCards = {};
        }

        if (!user.flags) {
            user.flags = {};
        }

        return user;
    }

    // Adventures
    async getAdventuresStatus() {
        let adventures = await Game.dbClient.db.collection(Collections.Adventures).findOne({ _id: this.id });

        let changed = false;

        if (!adventures) {
            changed = true;
            adventures = {
                adventures: []
            };

            let slot = await this._createNewAdventureSlot();
            adventures.adventures.push(slot);
        }

        let adventuresList = adventures.adventures;
        let i = 0;
        const length = adventuresList.length;
        for (; i < length; ++i) {
            let adventure = adventuresList[i];
            if (!adventure.hasOwnProperty("startTime")) {
                changed = true;
                adventuresList[i] = await this._createNewAdventureSlot();
            } else if ((adventure.startTime == 0 && !adventure.list) || (adventure.list && adventure.list.length == 0)) {
                changed = true;
                adventure.list = await this._rollAdventureList();
            }
        }

        if (changed) {
            await Game.dbClient.db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });
        }

        return adventures;
    }

    async buyAdventureSlot() {
        let adventures = await this.getAdventuresStatus();
        let adventuresMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "adventures_meta" });

        let slotIndex = adventures.adventures.length - 1;

        if (slotIndex >= adventuresMeta.prices.length) {
            return;
        }

        let price = adventuresMeta.prices[slotIndex];

        if (price.hard > this.hardCurrency || price.soft > this.softCurrency) {
            throw Errors.NotEnoughCurrency;
        }

        await this.addHardCurrency(-price.hard);
        await this.addSoftCurrency(-price.soft);

        let slot = await this._createNewAdventureSlot();
        adventures.adventures.push(slot);

        await Game.dbClient.db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });

        return slot;
    }

    async _createNewAdventureSlot() {
        let adventure = {
            startTime: 0,
            duration: 0
        }

        adventure.list = await this._rollAdventureList();
        return adventure;
    }

    async _rollAdventureList() {
        const length = this.adventuresList.length;
        let maxWeight = this.adventuresList[length - 1].weight;
        let ids = new Array(3);

        for (let i = 0; i < 3; ++i) {
            const roll = Random.range(0, maxWeight, true);
            for (let j = 0; j < length; ++j) {
                const record = this.adventuresList[j];
                ids[i] = record.key;

                if (roll <= record.weight) {
                    break;
                }
            }
        }

        const adventuresData = await Game.dbClient.db.collection(Collections.AdventuresList).find({ _id: { $in: ids } }).toArray();
        for (let i = 0; i < 3; ++i) {
            ids[i] = adventuresData.find(x => x._id == ids[i]);
        }

        return ids;
    }

    async startAdventure(slot, adventureIndex) {
        let adventures = await this.getAdventuresStatus();
        let list = adventures.adventures;

        if (slot < 0 || list.length <= slot) {
            throw Errors.UnknownAdventure;
        }

        let adventure = list[slot];
        if (adventure.startTime > 0) {
            throw Errors.AdventureInProcess;
        }

        if (adventure.list.length <= adventureIndex) {
            throw Errors.UnknownAdventure;
        }

        let adventureToStart = adventure.list[adventureIndex];
        adventureToStart.startTime = Game.now;
        list[slot] = adventureToStart;

        await Game.dbClient.db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });

        this._dailyQuests.onAdventureStarted();

        return adventureToStart;
    }

    async claimAdventure(slot) {
        let adventures = await this.getAdventuresStatus();
        let list = adventures.adventures;

        if (list.length <= slot) {
            throw Errors.UnknownAdventure;
        }

        let adventure = list[slot];

        if (adventure.startTime == 0) {
            throw Errors.AdventureClaimed;
        }

        if (Game.now - adventure.startTime < adventure.duration * 1000) {
            throw Errors.AdventureInProcess;
        }

        let items = await Game.lootGenerator.getLootFromTable(adventure.loot);
        await this._inventory.addItemTemplates(items);

        list[slot] = await this._createNewAdventureSlot();
        await Game.dbClient.db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });

        return {
            items,
            adventure: list[slot]
        };
    }

    async refreshAdventure(slot) {
        let adventures = await this.getAdventuresStatus();
        let list = adventures.adventures;

        if (list.length <= slot) {
            throw Errors.UnknownAdventure;
        }

        let adventure = list[slot];

        if (Game.now - adventure.startTime < adventure.duration * 1000) {
            throw Errors.AdventureInProcess;
        }

        if (!adventure.refreshTime || Game.now - adventure.refreshTime >= AdventureRefreshInterval) {
            adventure.list = await this._rollAdventureList();
            adventure.refreshTime = Game.now;
        } else {
            throw Errors.AdventureWasRefreshed;
        }

        await Game.dbClient.db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });

        return adventure;
    }

    refillTimerWithItems(stat, items, templates) {
        let i = 0;
        const length = templates.length;
        const baseStatValue = this.getTimerValue(stat);
        const maxStatValue = this.getMaxStatValue(stat);
        let relativeValue = 0;
        let absoluteValue = 0;
        for (; i < length; ++i) {
            const template = templates[i];
            const itemEntry = items[template._id];

            if (itemEntry.count > this.inventory.getItemById(itemEntry.id).count) {
                continue;
            }

            if (template.action.relative) {
                relativeValue += (maxStatValue * template.action.value * itemEntry.count) / 100;
            } else {
                absoluteValue += (template.action.value * itemEntry.count);
            }

            this.inventory.removeItem(itemEntry.id, itemEntry.count);
        }

        let timerValue = baseStatValue + relativeValue + absoluteValue;
        if (timerValue > this.getMaxStatValue(stat)) {
            timerValue = this.getMaxStatValue(stat);
        }

        this.setTimerValue(stat, Math.round(timerValue));
    }

    async selectClass(className) {
        const selections = (await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "classes" })).selections;
        // find suitable class
        let selection;
        for (let i = 0; i < selections.length; ++i) {
            if (selections[i].minLevel <= 5) {
                selection = selections[i];
            }
        }

        if (!selection) {
            throw Errors.CantChooseClass;
        }

        await this._loadAndCacheClassData(className);

        if (this._data.classInited) {
            // pay the price
            if (this.hardCurrency < this._meta.classPrice) {
                throw Errors.NotEnoughCurrency;
            }

            await this.addHardCurrency(-this._meta.classPrice);
        }

        this._data.classInited = true;
        this._data.character.class = className;

        // modify regen timers
        await this._updateTimersRegen();
    }

    async _loadAndCacheClassData(className) {
        if (!className) {
            return;
        }

        if (this._classSelected) {
            return this._classSelected;
        }

        const selections = (await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "classes" })).selections;
        // find suitable class
        let selection;
        for (let i = 0; i < selections.length; ++i) {
            if (selections[i].minLevel <= 5) {
                selection = selections[i];
            }
        }

        if (!selection) {
            throw Errors.CantChooseClass;
        }

        const classSelected = selection.classes.find(x => x.name == className);
        if (!classSelected) {
            throw Errors.UnknownClass;
        }

        this._classSelected = classSelected;

        return classSelected;
    }

    async getDailyRewardStatus() {
        const dailyRewardsMeta = (await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "daily_rewards" })).rewards;
        const dailyRewards = this._processDailyReward(dailyRewardsMeta);

        return {
            readyToCollect: dailyRewards.cycle < this.getDailyRewardCycle(),
            step: dailyRewards.step,
            untilNext: Config.game.dailyRewardCycle - Game.now % Config.game.dailyRewardCycle
        };
    }

    async getDailyRefillsStatus() {
        return {
            readyToCollect: this._data.dailyRefillCollect < this.getDailyRewardCycle(),
            untilNext: Config.game.dailyRewardCycle - Game.now % Config.game.dailyRewardCycle
        };
    }

    async executeDailyReset() {
        if (this._data.dailyRefillCollect >= this.getDailyRewardCycle()) {
            return;
        }

        this._data.dailyRefillCollect = this.getDailyRewardCycle();

        const lastCardsClaimed = this.subscriptions.lastClaimCycle;
        for (const id in this.cards) {
            const card = this.cards[id];
            const meta = await Game.shop.getCardMeta(id);

            if (meta.dailyHard == 0 && meta.dailySoft == 0) {
                continue;
            }

            let cardCycle = this.getDailyRewardCycle();
            if (card.end < Game.nowSec) {
                cardCycle = this.convertToCycle(card.end);
                if (cardCycle <= lastCardsClaimed) {
                    continue;
                }
            }

            const cyclesPassed = cardCycle - lastCardsClaimed;

            await this.addHardCurrency(meta.dailyHard * cyclesPassed);
            await this.addSoftCurrency(meta.dailySoft * cyclesPassed, true);
        }

        this.subscriptions.lastClaimCycle = this.getDailyRewardCycle();
        this.towerPurchased = false;
        this._trials.resetPurchases();

        const dailyRefillsMeta = (await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "daily_rewards" })).refills;
        const length = dailyRefillsMeta.length;
        for (let i = 0; i < length; ++i) {
            const refill = dailyRefillsMeta[i];

            let quantity = 0;
            for (let i = 0; i < refill.ranks.length; ++i) {
                const refillMeta = refill.ranks[i];
                if (refillMeta.rank <= this.rank) {
                    quantity = refillMeta.quantity;
                }
            }

            switch (refill.type) {
                case "tower":
                    this.freeTowerAttempts = quantity;
                    break;

                case "armourTrials":
                    this._trials.addAttempts(TrialType.Armour, quantity, true);
                    break;

                case "weaponTrials":
                    this._trials.addAttempts(TrialType.Weapon, quantity, true);
                    break;

                case "accessoryTrials":
                    this._trials.addAttempts(TrialType.Accessory, quantity, true);
                    break;
            }
        }

        for (const id in this.cards) {
            const card = this.cards[id];
            if (card.end < Game.nowSec) {
                continue;
            }

            const meta = await Game.shop.getCardMeta(id);

            this.applyBonusRefills(
                meta.towerAttempts,
                meta.armourTrialAttempts,
                meta.weaponTrialAttempts,
                meta.accessoryTrialAttempts
            );
        }

        this._data.sRaidAttempts = {};
        this.raceShop.reset();
    }

    getSoloRaidAttempts(raidId) {
        return this._data.sRaidAttempts[raidId] || 0;
    }

    increaseSoloRaidAttempts(raidId) {
        this._data.sRaidAttempts[raidId] = (this._data.sRaidAttempts[raidId] || 0) + 1;
    }

    applyBonusRefills(tower, armourTrial, weaponTrial, accTrial) {
        this.freeTowerAttempts += tower;
        this._trials.addAttempts(TrialType.Armour, armourTrial, true, true);
        this._trials.addAttempts(TrialType.Weapon, weaponTrial, true, true);
        this._trials.addAttempts(TrialType.Accessory, accTrial, true, true);
    }

    async getCardBonuses() {
        const bonuses = {
            soft: 0,
            dkt: 0,
            exp: 0
        };
        for (const id in this.cards) {
            const card = this.cards[id];
            if (card.end < Game.nowSec) {
                continue;
            }

            const meta = await Game.shop.getCardMeta(+id);

            bonuses.dkt += meta.addDkt;
            bonuses.soft += meta.addGold;
            bonuses.exp += meta.addExp;
        }
        return bonuses;
    }

    async hasFastCombat() {
        for (const id in this.cards) {
            const card = this.cards[id];
            if (card.end < Game.nowSec) {
                continue;
            }

            const meta = await Game.shop.getCardMeta(+id);

            if (meta.fastQuests) {
                return true;
            }
        }

        return false;
    }

    getDailyRewardCycle() {
        return Math.floor(Game.now / Config.game.dailyRewardCycle);
    }

    convertToCycle(timeSec) {
        return Math.floor(timeSec / (Config.game.dailyRewardCycle / 1000));
    }

    _processDailyReward(dailyRewardsMeta) {
        const dailyRewardCollect = this._data.dailyRewardCollect;

        if (dailyRewardCollect.step < 0 || dailyRewardCollect.step >= dailyRewardsMeta.length) {
            dailyRewardCollect.step = 0;
        }

        return dailyRewardCollect;
    }

    async collectDailyReward() {
        const dailyRewardsMeta = (await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "daily_rewards" })).rewards;
        const dailyRewardCollect = this._processDailyReward(dailyRewardsMeta);

        if (dailyRewardCollect.cycle >= this.getDailyRewardCycle()) {
            throw Errors.DailyRewardCollected;
        }

        const reward = dailyRewardsMeta[dailyRewardCollect.step];

        const item = {
            item: reward.itemId,
            quantity: Random.intRange(reward.minCount, reward.maxCount)
        }

        await this.inventory.addItemTemplate(item.item, item.quantity);

        dailyRewardCollect.cycle = this.getDailyRewardCycle();
        dailyRewardCollect.step++;

        this._data.dailyRewardCollect = dailyRewardCollect;

        return item;
    }

    async beastBoost(boostCount, regular, metaIndex = -1) {
        if (boostCount > BeastMaxBoost) {
            boostCount = BeastMaxBoost;
        }

        if (boostCount < 1) {
            boostCount = 1;
        }

        const beastMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "beasts" });

        if (regular) {
            const softRequired = boostCount * beastMeta.softPrice;

            if (softRequired > this.softCurrency) {
                throw Errors.NotEnoughSoft;
            }

            await this.addSoftCurrency(-softRequired);
        } else if (metaIndex == -1 || !isNumber(metaIndex)) {
            const ticketItem = this.inventory.getItemByTemplate(beastMeta.ticketItem);
            if (!ticketItem) {
                throw Errors.NoItem;
            }

            if (ticketItem.count < boostCount) {
                throw Errors.NotEnoughCurrency;
            }

            this.inventory.removeItem(ticketItem.id, boostCount);
        } else {
            const iapMeta = beastMeta.iaps[metaIndex];
            if (!iapMeta) {
                throw Errors.UknownIAP;
            }

            await this.addHardCurrency(-iapMeta.price);
            boostCount = iapMeta.tickets;
        }

        const result = await this._addExperienceToBeast(boostCount, beastMeta, regular);

        await this.dailyQuests.onBeastBoosted(boostCount);

        return result;
    }

    async _addExperienceToBeast(boostCount, beastMeta, regular) {
        if (beastMeta.levels.length <= this._data.beast.index) {
            this._data.beast.index = beastMeta.levels.length - 1;
            return;
        }

        let currentBeast = beastMeta.levels[this._data.beast.index];
        if (this._data.beast.level >= currentBeast.levels.length) {
            throw Errors.BeastMaxLevel;
        }

        let totalGained = 0;
        let expGained = currentBeast.levels[this._data.beast.level].expGained * (regular ? 1 : beastMeta.advancedBoostBonus);
        let expRequired = currentBeast.levels[this._data.beast.level].expRequired;

        let boostCritCount = 0;

        while (boostCount > 0) {
            boostCount--;
            let expToAdd = expGained;

            if (!regular && Random.range(1, 100, true) <= beastMeta.critBoostChance) {
                boostCritCount++;
                expToAdd *= 10;
            }

            totalGained += expToAdd;
            this._data.beast.exp += expToAdd;

            if (this._data.beast.exp >= expRequired) {
                this._data.beast.exp -= expRequired;
                this._data.beast.level++;
                this._recalculateStats = true;

                if (this._data.beast.level >= currentBeast.levels.length) {
                    this.evolveBeast(beastMeta);
                    break;
                }
            }
        }

        this._data.beast.exp = Math.round(this._data.beast.exp);

        return {
            crits: boostCritCount,
            exp: Math.round(totalGained)
        };
    }

    async evolveBeast(beastMeta) {
        if (!beastMeta) {
            beastMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "beasts" });
        }
        const currentBeast = beastMeta.levels[this._data.beast.index];

        // not enough level to evolve, should be last
        if (this._data.beast.level < currentBeast.levels.length) {
            throw Errors.BeastCantEvolve;
        }

        // can evolve
        if (this._data.beast.index < beastMeta.levels.length - 1) {
            this._data.beast.index++;
            this._data.beast.level = 0;
        }
    }

    getTowerFloorCombatUnit() {
        const towerFloor = this._data.tower.challengedFloor;
        return new TowerPlayerUnit(this.maxStats, towerFloor.userHealth, towerFloor.userMaxHealth, towerFloor.userLevel);
    }

    // Trials

    getTrialState(trialType, trialId) {
        return this._trials.getTrialState(trialType, trialId);
    }

    challengeTrial(trialType, trialId, stageId, fightIndex) {
        return this._trials.challengeFight(trialType, trialId, stageId, fightIndex);
    }

    fetchTrialFightMeta(trialType, trialId, stageId, fightIndex) {
        return this._trials.fetchFightMeta(trialType, trialId, stageId, fightIndex);
    }

    async attackTrial(trialType) {
        return await this._trials.attack(trialType);
    }

    async collectTrialStageReward(trialType, trialId, stageId) {
        return await this._trials.collectTrialStageReward(trialType, trialId, stageId);
    }

    async chooseTrialCard(trialType, cardIndex) {
        return await this._trials.pickCard(trialType, cardIndex);
    }

    async improveTrialCard(cardEffect) {
        this._trials.improveCard(cardEffect);
    }

    async resetTrialCards() {
        await this._trials.resetPoints();
    }

    async summonTrialCards(trialType) {
        return this._trials.summonTrialCards(trialType);
    }

    async purchaseTrialAttempts(trialType, iapIndex) {
        return this._trials.purchaseAttempts(trialType, iapIndex);
    }

    grantTrialAttempts(trialType, count) {
        this._trials.addAttempts(trialType, count, false);
    }

    async airDropItemsIfAny() {
        let i = 0;
        const length = this._meta.airDrops.length;
        for (; i < length; ++i) {
            const airdrop = this._meta.airDrops[i];
            if (this._data.airdrops[airdrop.id]) {
                continue;
            }

            if (airdrop.level > this.level) {
                continue;
            }

            await this._inventory.addItemTemplate(airdrop.item, airdrop.count);
            this._data.airdrops[airdrop.id] = 1;
        }

        const tester = await Game.db.collection("testers").findOne({ _id: this.address });
        if (tester && !tester.claimed) {
            await Game.db.collection("testers").updateOne({ _id: this.address }, { $set: { claimed: 1 } });
            await this._inventory.addItemTemplate(tester.itemId, 1);
        }
    }

    finishTutorial(stepId) {
        this._data.tutorial[stepId] = 1;
    }
}

export default User;