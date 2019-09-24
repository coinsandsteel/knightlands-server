'use strict';

import CharacterStats from "./knightlands-shared/character_stat";

import CharacterStat, {
    StatConversions
}
    from "./knightlands-shared/character_stat";

import TrainingCamp from "./knightlands-shared/training_camp";
import ItemStatResolver from "./knightlands-shared/item_stat_resolver";
import CurrencyType from "./knightlands-shared/currency_type";
import Game from "./game";
import Errors from "./knightlands-shared/errors";
import ItemProperties from "./knightlands-shared/item_properties";
import Random from "./random";
const WeightedList = require("./js-weighted-list");

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
const ItemActions = require("./knightlands-shared/item_actions");
const DefaultRegenTimeSeconds = 120;
const TimerRefillReset = 86400000;
const AdventureRefreshInterval = 86400000;

let DefaultStats = {}
DefaultStats[CharacterStats.Health] = 50;
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

    getChests() {
        return this._data.chests;
    }

    setChestFreeOpening(chest) {
        this._data.chests[chest] = Game.now;
    }

    // returns levels gained
    async addExperience(exp) {
        let character = this._data.character;
        let levelBeforeExp = character.level;
        character.exp += exp * 1;
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
        let timer = this.getTimer(stat);
        if (timer) {
            timer.value += value;
            this._advanceTimer(stat);
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
        this._itemStatResolver = new ItemStatResolver(this._meta.statConversions, this._meta.itemPower, this._meta.itemPowerSlotFactors, this._meta.charmItemPower);

        this._advanceTimers();

        await this._inventory.loadAll();

        let adventuresMeta = await this._db.collection(Collections.Meta).findOne({_id: "adventures_meta"});
        this.adventuresList = adventuresMeta.weightedList;

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

        let levelUpMeta = await this._db.collection(Collections.Meta).findOne({ _id: "levelUp" });

        let levelMetaData = levelUpMeta.records[character.level - 1].stats;

        finalStats[CharacterStats.Stamina] += levelMetaData[CharacterStats.Stamina];
        finalStats[CharacterStats.Energy] += levelMetaData[CharacterStats.Energy]
        // finalStats[CharacterStats.Honor] += levelUpMeta[CharacterStats.Energy]
        finalStats[CharacterStats.Health] += levelMetaData[CharacterStats.Health]

        let combatMeta = await this._db.collection(Collections.Meta).findOne({ _id: "combat_meta" });

        let mainHandType;
        let offHandType;
        let mainHandDamage;

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
        let items = await this._inventory.getPassiveItems();
        if (!items) {
            return;
        }
        
        let i = 0;
        const length = items.length;
        for (; i < length; i++) {
            let item = items[i];

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
                } else if (item.type == ItemType.Charm && prop.type == ItemProperties.MaxEffectStack) {
                    // apply stats
                    let max = item.maxStack;
                    if (max > item.count) {
                        max = item.count;
                    }
                    for (let stat in item.stats) {
                        finalStats[stat] += this._itemStatResolver.getStatValueForCharm(item.rarity, item.level, 0, stat, item.stats[stat]) * max;
                    }
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

    async useItem(itemId) {
        let itemToUse = this._inventory.getItemById(itemId);
        if (!itemToUse) {
            throw Errors.NoItem;
        }

        let template = await Game.itemTemplates.getTemplate(itemToUse.template);
        if (!template.action) {
            throw Errors.NotConsumable;
        }

        // remove used item
        this._inventory.removeItem(itemToUse.id);

        let actionData = template.action;
        // based on action perform necessary actions
        switch (actionData.action) {
            case ItemActions.RefillTimer:
                if (actionData.relative) {
                    // % restoration from maximum base 
                    this.modifyTimerValue(actionData.stat, this.getMaxStatValue(actionData.stat) * actionData.value / 100);
                } else {
                    this.modifyTimerValue(actionData.stat, actionData.value);
                }
                break;

            case ItemActions.AddExperience:
                await this.addExperience(actionData.value);
                break;

            case ItemActions.OpenBox:
                let items = await Game.lootGenerator.getLootFromTable(actionData.lootTable);
                await this.addLoot(items);
                return items;
        }
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
                _id: this.id
            }, finalQuery);

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

        if (!user.character.passiveStats) {
            user.character.passiveStats = { ...DefaultStats };
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

        const adventuresData = await this._db.collection(Collections.AdventuresList).find({_id:{$in: ids}}).toArray();
        for (let i = 0; i < 3; ++i) {
            ids[i] = adventuresData.find(x=>x._id == ids[i]);
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
        let relativeValue = 0;
        let absoluteValue = 0;
        for (; i < length; ++i) {
            const template = templates[i];
            const itemEntry = items[template._id];

            if (template.action.relative) {
                relativeValue += (baseStatValue * template.action.value * itemEntry.count) / 100;
            } else {
                absoluteValue += (template.action.value * itemEntry.count);
            }

            this.inventory.removeItem(itemEntry.id, itemEntry.count);
        }

        let timerValue = baseStatValue + relativeValue + absoluteValue;
        if (timerValue > this.getMaxStatValue(stat)) {
            timerValue = this.getMaxStatValue(stat);
        }

        this.setTimerValue(stat, timerValue);
    }

    async selectClass(className) {
        const selections = (await this._db.collection(Collections.Meta).findOne({_id: "classes"})).selections;
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

        const classSelected = selection.classes.find(x=>x.name == className);
        if (!classSelected) {
            throw Errors.UnknownClass;
        }

        this._data.classInited = true;

        // modify regen timers
        this.getTimer(CharacterStats.Energy).regenTime = classSelected.energyRegen;
        this.getTimer(CharacterStats.Stamina).regenTime = classSelected.staminaRegen;
    }
}

module.exports = User;