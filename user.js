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
import Random from "./random";
import TrialType from "./knightlands-shared/trial_type";

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
const GoldExchange = require("./goldExchange");
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
} = require("./database");

function extraStatIfItemOwned(property, count, finalStats) {
    count = property.maxItemCount < count ? property.maxItemCount : count;
    finalStats[property.stat] += property.value * count;
}

class User {
    constructor(address, db, expTable, meta) {
        this.FullInventoryChanges = 1;
        this.DeltaInventoryChanges = 2;

        this._address = address;
        this._db = db;
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
        delete data._id;
        delete data.nonce;
        delete data.address;

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

    get address() {
        return this._address;
    }

    get enoughHp() {
        return this.getTimerValue(CharacterStats.Health) >= 10;
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

    async getWeaponCombatData() {
        let weapon = this._data.character.equipment[EquipmentSlots.MainHand];
        if (!weapon) {
            return null;
        }

        let template = await Game.itemTemplates.getTemplate(weapon.template);
        return {
            element: template.element,
            type: template.equipmentType
        }
    }

    getCombatUnit(config) {
        let stats = this.maxStats;
        if (config && config.raid) {
            this._buffsResolver.calculate(Game.now, this.rawStats, this._data.character.buffs, config.raid);
            stats = this._buffsResolver.finalStats;
        }
        return new PlayerUnit(this, stats);
    }

    addSoftCurrency(value, ignorePassiveBonuses = false) {
        if (value > 0 && !ignorePassiveBonuses) {
            value *= (1 + this.getMaxStatValue(CharacterStat.ExtraGold) / 100);
        }

        value = Math.round(value);

        this._inventory.modifyCurrency(CurrencyType.Soft, value);

        return value;
    }

    addHardCurrency(value) {
        this._inventory.modifyCurrency(CurrencyType.Hard, value);
    }

    addDkt(value) {
        value *= (1 + this.getMaxStatValue(CharacterStat.ExtraDkt) / 100);
        this._inventory.modifyCurrency(CurrencyType.Dkt, Math.round(value));
    }

    getChests() {
        return this._data.chests;
    }

    setChestFreeOpening(chest) {
        this._data.chests[chest] = Game.now;
    }

    async addExperience(exp) {
        const totalExp = exp * (1 + this.getMaxStatValue(CharacterStat.ExtraExp) / 100);
        
        const character = this._data.character;
        character.exp += totalExp;

        const maxLevels = this._expTable.length;
        const previousLevel = character.level;
        while (character.level < maxLevels) {
            let toNextLevel = this._expTable[character.level - 1];
            if (toNextLevel <= character.exp) {
                character.level++;
                character.exp -= toNextLevel;
            } else {
                break;
            }
        }

        if (previousLevel < character.level) {
            let levelUpMeta = await this._db.collection(Collections.Meta).findOne({ _id: "levelUp" });

            for (let i = previousLevel; i < character.level; ++i) {
                // assign currencies
                let levelMeta = levelUpMeta.records[i];
                if (levelMeta) {
                    this.addSoftCurrency(levelMeta.soft);
                    this.addHardCurrency(levelMeta.hard);
                }
            }

            this._recalculateStats = true;
            this._restoreTimers();
        }

        return totalExp;
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

    modifyTimerValue(stat, value) {
        let timer = this.getTimer(stat);
        if (timer) {
            this._advanceTimer(stat);
            timer.value += value;

            if (timer.value > this.getMaxStatValue(stat)) {
                timer.value = this.getMaxStatValue(stat);
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

    async getTimerRefillCost(stat) {
        if (stat == CharacterStats.Health) {
            return {
                soft: Math.ceil((this.getMaxStatValue(stat) - this.getTimerValue(stat)) * 1 * this._data.character.level * 0.1)
            };
        }

        let refills = await Game.db.collection(Collections.Meta).findOne({ _id: `${stat}_refill_cost` });

        let refillsToday = this.getRefillsCount(stat);

        if (refillsToday >= refills.cost.length) {
            refillsToday = refills.cost.length - 1;
        }

        return refills.cost[refillsToday];
    }

    refillTimer(stat, refills) {
        let timer = this.getTimer(stat);
        timer.value = this.getMaxStatValue(stat);

        if (!refills) {
            refills = this.getRefillsCount(stat);
        }

        timer.refills = refills + 1;
        this._advanceTimer(stat);
    }

    _advanceTimers() {
        for (let i in this._data.character.timers) {
            this._advanceTimer(i);
        }
    }

    _advanceTimer(stat) {
        let now = Game.nowMs; 
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
            this._originalData.character.timers[stat] = cloneDeep(timer);
        }
    }

    async generateNonce() {
        this._data.nonce = uuidv4();
        const users = this._db.collection(Collections.Users);
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

    async load() {
        const users = this._db.collection(Collections.Users);

        let userData = this._validateUser({
            address: this._address
        });

        userData = (await users.findOneAndUpdate(
            {
                address: this._address
            },
            {
                $setOnInsert: userData,
            },
            {
                returnNewDocument: true,
                upsert: true
            }
        )).value;

        this._originalData = cloneDeep(userData);
        userData = this._validateUser(userData);

        this._data = userData;
        this._inventory = new Inventory(this._address, this._db);
        this._crafting = new Crafting(this._address, this._inventory, this._data.character.equipment);
        this._itemStatResolver = new ItemStatResolver(this._meta.statConversions, this._meta.itemPower, this._meta.itemPowerSlotFactors, this._meta.charmItemPower);
        this._trials = new Trials(this._data.trials, this);
        this._goldExchange = new GoldExchange(this._data.goldExchange, this);
        this._dailyQuests = new DailyQuests(this._data.dailyQuests, this);

        this._advanceTimers();

        await this._inventory.loadAll();
        await this._trials.init();
        await this._goldExchange.init();
        await this._dailyQuests.init();

        let adventuresMeta = await this._db.collection(Collections.Meta).findOne({ _id: "adventures_meta" });
        this.adventuresList = adventuresMeta.weightedList;

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
        const trainingMeta = await this._db.collection(Collections.Meta).findOne({ _id: "training_camp" });
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
            this._data.character.attributes[i] += stats[i];

            const finalValue = this._data.character.attributes[i];

            if (finalValue > TrainingCamp.getMaxStat(this._data.character.level)) {
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

        this.addSoftCurrency(-totalGoldRequired);
        this._recalculateStats = true;
    }

    async onInventoryChanged() {
        await this._calculateFinalStats(true);
    }

    async _calculateFinalStats(force = false) {
        if (!force && !this._recalculateStats) {
            return;
        }

        let finalStats = Object.assign({}, DefaultStats);
        let character = this._data.character;
        for (let i in character.attributes) {
            finalStats[i] += StatConversions[i] * character.attributes[i];
        }

        let levelUpMeta = await this._db.collection(Collections.Meta).findOne({ _id: "levelUp" });

        let levelMetaData = levelUpMeta.records[character.level - 1].stats;

        finalStats[CharacterStats.Stamina] += levelMetaData[CharacterStats.Stamina];
        finalStats[CharacterStats.Energy] += levelMetaData[CharacterStats.Energy]
        // finalStats[CharacterStats.Honor] += levelUpMeta[CharacterStats.Energy]
        finalStats[CharacterStats.Health] += levelMetaData[CharacterStats.Health]

        let combatMeta = await this._db.collection(Collections.Meta).findOne({ _id: "combat_meta" });

        let mainHandType;
        let offHandType;

        // calculate stats from equipment
        for (let itemId in character.equipment) {
            let equippedItem = character.equipment[itemId];
            let template = await Game.itemTemplates.getTemplate(equippedItem.template);
            if (!template) {
                continue;
            }

            let slot = getSlot(template.equipmentType);
            if (slot == EquipmentSlots.MainHand) {
                mainHandType = template.equipmentType;
            } else if (slot == EquipmentSlots.OffHand) {
                offHandType = template.equipmentType;
            }

            for (let stat in template.stats) {
                let statValue = this._itemStatResolver.getStatValue(template.rarity, slot, equippedItem.level, equippedItem.enchant, stat, template.stats[stat]);
                finalStats[stat] += statValue;
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
            const beastsMeta = await this._db.collection(Collections.Meta).findOne({ _id: "beasts" });
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


        let oldStats = character.stats;
        this.rawStats = finalStats;

        await this._recalculateBuffs(false);
        finalStats = character.stats;

        // correct timers
        for (let i in character.timers) {
            let timer = character.timers[i];
            if (timer.value == oldStats[i]) {
                timer.value = finalStats[i];
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
                for (let stat in item.stats) {
                    finalStats[stat] += this._itemStatResolver.getStatValueForCharm(item.rarity, item.level, 0, stat, item.stats[stat]) * max;
                }
            }

            const props = item.properties;
            let k = 0;
            const pLength = props.length;
            for (; k < pLength; ++k) {
                let prop = props[k];
                if (prop.type == ItemProperties.ExtraStatIfItemNotEquipped) {
                    extraStatIfItemOwned(prop, item.count, finalStats);
                }
                else if (item.type == ItemType.Charm && prop.type == ItemProperties.ExtraStatIfItemOwned) {
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
        await this._inventory.addItemTemplates(itemTemplates);
    }

    async useItem(itemId, count = 1) {
        let itemToUse = this._inventory.getItemById(itemId);
        if (!itemToUse) {
            throw Errors.NoItem;
        }

        if (itemToUse.count < count) {
            throw Errors.NoEnoughItems;
        }

        let template = await Game.itemTemplates.getTemplate(itemToUse.template);
        if (!template.action) {
            throw Errors.NotConsumable;
        }

        // remove used item
        this._inventory.removeItem(itemToUse.id, count);

        let actionData = template.action;
        const actionValue = actionData.value * count;
        // based on action perform necessary actions
        switch (actionData.action) {
            case ItemActions.RefillTimer:
                if (actionData.relative) {
                    // % restoration from maximum base 
                    this.modifyTimerValue(actionData.stat, this.getMaxStatValue(actionData.stat) * actionValue / 100);
                } else {
                    this.modifyTimerValue(actionData.stat, actionValue);
                }
                break;

            case ItemActions.AddExperience:
                await this.addExperience(actionValue);
                break;

            case ItemActions.OpenBox:
                let items = await Game.lootGenerator.getLootFromTable(actionData.lootTable, null, count);
                await this.addLoot(items);
                return items;

            case ItemActions.Buff:
            case ItemActions.RaidBuff:
                return await this._applyBuff(template._id, actionData);
        }
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
                raid: actionData.raid,
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
        await this._db.collection(Collections.Users).updateOne({
            address: this._address
        }, {
            $set: {
                "character.buffs": this._data.character.buffs
            }
        });
    }

    async equipItem(itemId) {
        await this._inventory.loadAllItems();

        let itemToEquip = this._inventory.getItemById(itemId);
        if (!itemToEquip) {
            throw Errors.NoItem;
        }

        if (itemToEquip.equipped) {
            throw "already equipped";
        }

        let template = await await Game.itemTemplates.getTemplate(itemToEquip.template);
        if (!template) {
            throw "no such template";
        }

        if (template.type != ItemType.Equipment) {
            throw "not equipment";
        }

        let slotId = getSlot(template.equipmentType);
        await this.unequipItem(slotId);

        itemToEquip.equipped = true;

        // put into equipment and remove from inventory
        this._data.character.equipment[slotId] = {
            ...itemToEquip
        };
        this._data.character.equipment[slotId].count = 1; // make it count as 1, otherwise players will dupe it

        this._inventory.removeItem(itemToEquip.id);

        this._recalculateStats = true;
    }

    async unequipItem(itemSlot) {
        await this._inventory.loadAllItems();

        let oldItemInSlot = this._data.character.equipment[itemSlot];
        if (oldItemInSlot) {
            delete this._data.character.equipment[itemSlot];
            // return to inventory
            this._inventory.addItem(oldItemInSlot).equipped = false;
            this._recalculateStats = true;
        }
    }

    async upgradeItem(itemId, materials, count) {
        return await this._crafting.upgradeItem(itemId, materials, count);
    }

    async enchantItem(itemId, currency) {
        return await this._crafting.enchantItem(itemId, currency);
    }

    async unbindItem(itemId, items) {
        return await this._crafting.unbindItem(itemId, items);
    }

    async craftRecipe(recipeId, currency) {
        return await this._crafting.craftRecipe(recipeId, currency);
    }

    async commitChanges(inventoryChangesMode) {
        await this._calculateFinalStats();

        let users = this._db.collection(Collections.Users);
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

        await this._inventory.commitChanges(inventoryChangesMode);

        // apply new data as original
        return {
            changes,
            removals
        };
    }

    _validateUser(user) {
        if (!user.character) {
            let character = {
                level: 1,
                exp: 0,
                timers: {
                    health: {
                        value: 0,
                        lastRegenTime: 0,
                        regenTime: 30
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
                stats: { ...DefaultStats },
                attributes: {
                    health: 0,
                    attack: 0,
                    defense: 0,
                    luck: 0,
                    energy: 0,
                    stamina: 0
                },
                buffs: [],
                equipment: {}
            };

            user.character = character;
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

        if (!user.goldExchange) {
            user.goldExchange = {
                cycle: 0,
                freeObtains: 0,
                freeBoosts: 0,
                premiumBoosts: 0,
                level: 0,
                exp: 0
            };
        }

        if (!user.dailyQuests) {
            user.dailyQuests = {};
        }

        return user;
    }

    // Adventures
    async getAdventuresStatus() {
        let adventures = await this._db.collection(Collections.Adventures).findOne({ _id: this.id });

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
            }
            else if ((adventure.startTime == 0 && !adventure.list) || (adventure.list && adventure.list.length == 0)) {
                changed = true;
                adventure.list = await this._rollAdventureList();
            }
        }

        if (changed) {
            await this._db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });
        }

        return adventures;
    }

    async buyAdventureSlot() {
        let adventures = await this.getAdventuresStatus();
        let adventuresMeta = await this._db.collection(Collections.Meta).findOne({ _id: "adventures_meta" });

        let slotIndex = adventures.adventures.length - 1;

        if (slotIndex >= adventuresMeta.prices.length) {
            return;
        }

        let price = adventuresMeta.prices[slotIndex];

        this.addHardCurrency(-price.hard);
        this.addSoftCurrency(-price.soft);

        let slot = await this._createNewAdventureSlot();
        adventures.adventures.push(slot);

        await this._db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });

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

        const adventuresData = await this._db.collection(Collections.AdventuresList).find({ _id: { $in: ids } }).toArray();
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

        await this._db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });

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
        await this._db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });

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

        await this._db.collection(Collections.Adventures).replaceOne({ _id: this.id }, adventures, { upsert: true });

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
        const selections = (await this._db.collection(Collections.Meta).findOne({ _id: "classes" })).selections;
        // find suitable class
        let selection;
        for (let i = 0; i < selections.length; ++i) {
            if (selections[i].minLevel <= this._data.character.level) {
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

        this._data.classInited = true;

        // modify regen timers
        this.getTimer(CharacterStats.Energy).regenTime = classSelected.energyRegen;
        this.getTimer(CharacterStats.Stamina).regenTime = classSelected.staminaRegen;
    }

    async getDailyRewardStatus() {
        const dailyRewardsMeta = (await this._db.collection(Collections.Meta).findOne({ _id: "daily_rewards" })).rewards;
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

    async collectDailyRefills() {
        if (this._data.dailyRefillCollect >= this.getDailyRewardCycle()) {
            throw Errors.DailyRefillCollected;
        }

        this._data.dailyRefillCollect = this.getDailyRewardCycle();

        const dailyRefillsMeta = (await this._db.collection(Collections.Meta).findOne({ _id: "daily_rewards" })).refills;
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
            }
        }
    }

    getDailyRewardCycle() {
        return Math.floor(Game.now / Config.game.dailyRewardCycle);
    }

    _processDailyReward(dailyRewardsMeta) {
        const dailyRewardCollect = this._data.dailyRewardCollect;
        const currentRewardCycle = this.getDailyRewardCycle();
        const missedDays = currentRewardCycle - dailyRewardCollect.cycle;

        if (missedDays > 1) {
            dailyRewardCollect.step = 0;
        }

        if (dailyRewardCollect.step < 0 || dailyRewardCollect.step >= dailyRewardsMeta.length) {
            dailyRewardCollect.step = 0;
        }

        return dailyRewardCollect;
    }

    async collectDailyReward() {
        const dailyRewardsMeta = (await this._db.collection(Collections.Meta).findOne({ _id: "daily_rewards" })).rewards;
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

    async beastBoost(boostCount, regular) {
        if (boostCount > BeastMaxBoost) {
            boostCount = BeastMaxBoost;
        }

        if (boostCount < 1) {
            boostCount = 1;
        }

        const beastMeta = await this._db.collection(Collections.Meta).findOne({ _id: "beasts" });

        const result = this._addExperienceToBeast(boostCount, beastMeta, regular);

        if (regular) {
            const softRequired = boostCount * beastMeta.softPrice;

            if (softRequired > this.softCurrency) {
                throw Errors.NotEnoughSoft;
            }

            this.addSoftCurrency(-softRequired);
        } else {
            const ticketItem = this.inventory.getItemByTemplate(beastMeta.ticketItem);
            if (!ticketItem) {
                throw Errors.NoItem;
            }

            if (ticketItem.count < boostCount) {
                throw Errors.NotEnoughCurrency;
            }

            this.inventory.removeItem(ticketItem.id, boostCount);
        }

        return result;
    }

    _addExperienceToBeast(boostCount, beastMeta, regular) {
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

            if (!regular && Random.range(1, 100, true) <= beastMeta.critBoostChance) {
                boostCritCount++;
                totalGained += expGained * 10;
                this._data.beast.exp += expGained * 10;
            } else {
                totalGained += expGained;
                this._data.beast.exp += expGained;
            }

            if (this._data.beast.exp >= expRequired) {
                this._data.beast.exp -= expRequired;
                this._data.beast.level++;
                this._recalculateStats = true;

                if (this._data.beast.level >= currentBeast.levels.length) {
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

    async evolveBeast() {
        const beastMeta = await this._db.collection(Collections.Meta).findOne({ _id: "beasts" });
        const currentBeast = beastMeta.levels[this._data.beast.index];

        // not enough level to evolve, should be last
        if (this._data.beast.level < currentBeast.levels.length) {
            throw Errors.BeastCantEvolve;
        }

        // can evolve
        if (this._data.beast.index < beastMeta.levels.length + 1) {
            this._data.beast.index++;
            this._data.beast.level = 0;
            this._data.beast.exp = 0;
        }
    }

    getTowerFloorCombatUnit() {
        const towerFloor = this._data.tower.challengedFloor;
        return new TowerPlayerUnit(this.maxStats, towerFloor.userHealth, towerFloor.userMaxHealth);
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
        this._trials.resetPoints();
    }

    async summonTrialCards(trialType) {
        return this._trials.summonTrialCards(trialType);
    }

    grantTrialAttempts(trialType, count) {
        this._trials.addAttempts(trialType, count, false);
    }
}

module.exports = User;