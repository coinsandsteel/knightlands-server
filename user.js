'use strict';

import CharacterStats from "./knightlands-shared/character_stat";

import {
    StatConversions
}
    from "./knightlands-shared/character_stat";

import TrainingCamp from "./knightlands-shared/training_camp";
import ItemStatResolver from "./knightlands-shared/item_stat_resolver";
import CurrencyType from "./knightlands-shared/currency_type";
import Game from "./game";
import Errors from "./knightlands-shared/errors";
import ItemProperties from "./knightlands-shared/item_properties";

const {
    EquipmentSlots,
    getSlot
} = require("./knightlands-shared/equipment_slot");

const ItemType = require("./knightlands-shared/item_type");

const uuidv4 = require('uuid/v4');
const cloneDeep = require('lodash.clonedeep');
const PlayerUnit = require("./combat/playerUnit");
const Inventory = require("./inventory");
const Crafting = require("./crafting/crafting");
const DefaultRegenTimeSeconds = 120;
const TimerRefillReset = 86400000;

let DefaultStats = {}
DefaultStats[CharacterStats.Health] = 100;
DefaultStats[CharacterStats.Attack] = 5;
DefaultStats[CharacterStats.CriticalChance] = 2;
DefaultStats[CharacterStats.Energy] = 30;
DefaultStats[CharacterStats.CriticalDamage] = 50;
DefaultStats[CharacterStats.Stamina] = 5;
DefaultStats[CharacterStats.Honor] = 1;
DefaultStats[CharacterStats.Luck] = 0;
DefaultStats[CharacterStats.Defense] = 0;
DefaultStats[CharacterStats.ExtraDkt] = 0;
DefaultStats[CharacterStats.ExtraExp] = 0;
DefaultStats[CharacterStats.ExtraGold] = 0;
DefaultStats[CharacterStats.RaidDamage] = 0;

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

    getCombatUnit() {
        return new PlayerUnit(this);
    }

    addSoftCurrency(value) {
        this._inventory.modifyCurrency(CurrencyType.Soft, value);
    }

    addHardCurrency(value) {
        this._inventory.modifyCurrency(CurrencyType.Hard, value);
    }

    addDkt(value) {
        this._inventory.modifyCurrency(CurrencyType.Dkt, value);
    }

    // returns levels gained
    addExperience(exp) {
        let character = this._data.character;
        let levelBeforeExp = character.level;
        let maxLevel = 100;
        character.exp += exp * 1;
        let leveledUp = false;
        while (maxLevel-- > 0) {
            let toNextLevel = this._expTable[character.level - 1];
            if (toNextLevel <= character.exp) {
                character.level++;
                character.exp -= toNextLevel;
                leveledUp = true;
            } else {
                break;
            }
        }

        if (leveledUp) {
            this._recalculateStats = true;
            this._restoreTimers();
        }

        return character.level - levelBeforeExp;
    }

    _restoreTimers() {
        this.getTimer(CharacterStats.Energy).value = this._data.character.stats[CharacterStats.Energy];
        this.getTimer(CharacterStats.Stamina).value = this._data.character.stats[CharacterStats.Stamina];
        this.getTimer(CharacterStats.Health).value = this._data.character.stats[CharacterStats.Health];
    }

    getTimer(stat) {
        return this._data.character.timers[stat];
    }

    getMaxStatValue(stat) {
        return this._data.character.stats[stat];
    }

    getTimerValue(stat) {
        this._advanceTimer(stat);
        return this.getTimer(stat).value;
    }

    setTimerValue(stat, value) {
        this.getTimer(stat).value = value;
        this._advanceTimer(stat);
    }

    modifyTimerValue(stat, value) {
        this.getTimer(stat).value += value;
        this._advanceTimer(stat);
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

        let refills = await Game.db.collection(Collections.Meta).findOne({_id: `${stat}_refill_cost`});

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
        let now = Math.floor(new Date().getTime() / 1000); // milliseconds to seconds
        let character = this._data.character;
        let timer = this.getTimer(stat);

        if (character.stats[stat] <= timer.value) {
            timer.lastRegenTime = now;
            return;
        }

        let timePassed = now - timer.lastRegenTime;
        let valueRenerated = Math.floor(timePassed / timer.regenTime);
        timer.value += valueRenerated;
        // clamp to max value
        timer.value = character.stats[stat] < timer.value ? character.stats[stat] : timer.value;
        // adjust regen time to accomodate rounding
        timer.lastRegenTime += valueRenerated * timer.regenTime;
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
        let userData = await users.findOne({
            address: this._address
        });

        if (!userData) {
            userData = this._validateUser({
                address: this._address
            });
            await users.insertOne(userData);
        } else {
            userData = this._validateUser(userData);
        }

        this._data = userData;
        this._originalData = cloneDeep(userData);
        this._inventory = new Inventory(this._address, this._db);
        this._crafting = new Crafting(this._address, this._inventory);
        this._itemStatResolver = new ItemStatResolver(this._meta.statConversions, this._meta.itemPower, this._meta.itemPowerSlotFactors);

        this._advanceTimers();

        await this._inventory.loadAll();

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
        let totalGoldRequired = 0;
        for (let i in stats) {
            if (!Number.isInteger(stats[i])) {
                return `incorrect stat ${i}`;
            }

            if (!this._data.character.attributes.hasOwnProperty(i)) {
                return `incorrect stat ${i}`;;
            }

            let value = this._data.character.attributes[i];
            this._data.character.attributes[i] += stats[i];
            const finalValue = this._data.character.attributes[i];

            if (finalValue > TrainingCamp.getMaxStat(this._data.character.level)) {
                throw "stat is over max level";
            }

            for (; value < finalValue; value++) {
                totalGoldRequired += TrainingCamp.getStatCost(i, value);
            }
        }

        if (totalGoldRequired == 0) {
            return;
        }

        if (totalGoldRequired > this.softCurrency) {
            throw "not enough sc";
        }

        this.addSoftCurrency(-totalGoldRequired);
        this._recalculateStats = true;
    }

    async _calculateFinalStats() {
        if (!this._recalculateStats) {
            return;
        }

        let finalStats = Object.assign({}, DefaultStats);
        let character = this._data.character;
        for (let i in character.attributes) {
            finalStats[i] += StatConversions[i] * character.attributes[i];
        }

        finalStats[CharacterStats.Stamina] += character.level;
        finalStats[CharacterStats.Energy] += character.level * 2;
        finalStats[CharacterStats.Honor] += character.level;
        finalStats[CharacterStats.Health] += character.level * 20;

        // calculate stats from equipment
        for (let itemId in character.equipment) {
            let equippedItem = character.equipment[itemId];
            let template = await Game.itemTemplates.getTemplate(equippedItem.template);
            if (!template) {
                continue;
            }

            let slot = getSlot(template.equipmentType);

            for (let stat in template.stats) {
                let statValue = this._itemStatResolver.getStatValue(template.rarity, slot, equippedItem.level, stat, template.stats[stat]);
                finalStats[stat] += statValue;
            }
        }

        // calculate stats from inventory passive items
        await this._applyInventoryPassives(finalStats);

        let oldStats = character.stats;
        this._data.character.stats = finalStats;

        // correct timers
        for (let i in character.timers) {
            let timer = character.timers[i];
            if (timer.value == oldStats[i]) {
                timer.value = finalStats[i];
            }
        }
    }

    async _applyInventoryPassives(finalStats) {
        let items = await this._inventory.getItemsWithTemplate();
        let i = 0;
        const length = items.length;
        for (; i < length; i++) {
            let item = items[i];
            
            if (item.type == ItemType.Charm) {
                // apply stats
                for (let stat in item.stats) {
                    finalStats[stat] += this._itemStatResolver.getStatValue(item.rarity, slot, item.level, stat, item.stats[stat]);
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

    async upgradeItem(itemId, materialId, count) {
        return await this._crafting.upgradeItem(itemId, materialId, count);
    }

    async unbindItem(itemId, items) {
        return await this._crafting.unbindItem(itemId, items);
    }

    async craftRecipe(recipeId, currencyType) {
        return await this._crafting.craftRecipe(recipeId, currencyType);
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
                _id: this.id
            }, finalQuery);
        }

        await this._inventory.commitChanges(inventoryChangesMode);

        // apply new data as original
        this._originalData = cloneDeep(this._data);

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
                stats: {...DefaultStats},
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

        if (!user.character.passiveStats) {
            user.character.passiveStats = {...DefaultStats};
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

        if (!user.hasOwnProperty("raidTickets")) {
            user.raidTickets = 0;
        }

        return user;
    }
}

module.exports = User;