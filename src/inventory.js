const {
    Collections
} = require("./database");

import ItemType from "./knightlands-shared/item_type";
import Elements from "./knightlands-shared/elements";
import Game from "./game";
import Errors from "./knightlands-shared/errors";
import CurrencyType from "./knightlands-shared/currency_type";
import RankingType from "./knightlands-shared/ranking_type";
import { getSlot, EquipmentSlots } from "./knightlands-shared/equipment_slot";
import { ObjectId } from "mongodb";

const UserHolder = -1;

class Inventory {
    constructor(user, db) {
        this._db = db;
        this._userId = user.address;
        this._user = user;
        this._items = [];
        this._itemsByTemplate = {};
        this._itemsById = new Map(); // keeps index in items array
        this._itemsByIdOriginal = new Map(); // original copy to detect changes
        this._lastItemId = 0;
        this._currencies = {};
        this._loaded = false;

        // keep track of changes to commit later
        this._removedItems = new Map();
        this._newItems = new Map();
    }

    static get CurrencyUpdated() {
        return "cur";
    }

    static get Changed() {
        return "inventory_changed";
    }

    get info() {
        return {
            items: this._items,
            currencies: this._currencies
        }
    }

    async getMeta() {
        if (!this._meta) {
            this._meta = await Game.db.collection(Collections.Meta).findOne({
                _id: "meta"
            });
        }
        
        return this._meta;
    }

    getCurrency(currency) {
        return this._currencies[currency] || 0;
    }

    async modifyCurrency(currency, value) {
        if (!this._currencies[currency]) {
            this._currencies[currency] = value * 1;
        } else {
            this._currencies[currency] += value * 1;
        }

        if (currency == CurrencyType.Soft) {
            if (value < 0) {
                await this._user.dailyQuests.onGoldSpent(-value);
                await Game.rankings.updateRank(this._user.id, {
                    type: RankingType.GoldSpent
                }, -value);
            } else {
                await Game.rankings.updateRank(this._user.id, {
                    type: RankingType.GoldLooted
                }, value);
            }
            
        } else if (currency == CurrencyType.Hard && value < 0) {
            await this._user.dailyQuests.onPremiumPurchase(-value);
        }
    }

    static async loadItems(userId, ids) {
        return Game.db.collection(Collections.Inventory).aggregate([
            {
                $match: {
                    "_id": userId
                }
            },
            {
                $project: {
                    items: {
                        $filter: {
                            input: "$items",
                            as: "item",
                            cond: {
                                $in: ["$$item.id", ids]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0
                }
            }
        ],
            {
                "allowDiskUse": false
            }).toArray();
    }

    async getPassiveItems() {
        // join items with templates
        let items = await this._db.collection(Collections.Inventory).aggregate([
            {
                "$match": {
                    "_id": this._userId
                }
            },
            {
                "$lookup": {
                    "from": "items",
                    "localField": "items.template",
                    "foreignField": "_id",
                    "as": "templates"
                }
            },
            {
                "$project": {
                    "items": {
                        "$map": {
                            "input": "$items",
                            "as": "item",
                            "in": {
                                "$mergeObjects": [
                                    "$$item",
                                    {
                                        "$arrayElemAt": [
                                            {
                                                "$filter": {
                                                    "input": "$templates",
                                                    "as": "template",
                                                    "cond": {
                                                        "$eq": [
                                                            "$$template._id",
                                                            "$$item.template"
                                                        ]
                                                    }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    items: {
                        $filter: {
                            input: "$items",
                            as: "item",
                            cond: {
                                $or: [
                                    {
                                        $gt: [
                                            { $size: "$$item.properties" },
                                            0
                                        ]
                                    },
                                    {
                                        $eq: ["$$item.type", ItemType.Charm]
                                    }
                                ]
                            }
                        }
                    }
                }


            }
        ],
            {
                "allowDiskUse": false
            }).toArray();

        return items && items.length > 0 && items[0].items;
    }

    get nextId() {
        return ++this._lastItemId;
    }

    async loadAll() {
        if (this._loaded) {
            return;
        }

        this._loaded = true;

        let inventory = await this._db.collection(Collections.Inventory).findOne({
            _id: this._userId
        });

        if (!inventory) {
            return;
        }

        this._lastItemId = inventory.lastItemId;

        if (inventory.items) {
            this._items = inventory.items;

            // build index 
            let i = 0;
            const length = this._items.length;
            for (; i < length; i++) {
                let item = this._items[i];
                this._itemsById.set(item.id, i);
                this._itemsByIdOriginal.set(item.id, item.count);
                this._addItemToIndexByTemplate(item);
            }
        }

        if (inventory.currencies) {
            this._currencies = inventory.currencies;
        }
    }

    async loadAllItems() {
        await this.loadAll();
        return this._items;
    }

    async autoCommitChanges(changeCallback) {
        await this.loadAllItems();
        let reponse = await changeCallback(this);
        await this.commitChanges();
        return reponse;
    }

    async commitChanges() {
        if (!this._loaded) {
            return;
        }

        let changes = {}; // what was changed
        let delta = {}; // stack delta that was added/removed
        let queries = [];
        // update/insert queries
        if (this._newItems.size > 0) {
            // replace queries 
            for (let [id, item] of this._newItems) {
                let query;

                changes[id] = item;

                if (this._itemsByIdOriginal.has(id)) {
                    query = {
                        updateOne: {
                            filter: {
                                "_id": this._userId,
                                "items.id": id
                            },
                            update: {
                                $set: {
                                    "items.$": item
                                }
                            },
                            upsert: true
                        }
                    };
                    delta[id] = item.count - this._itemsByIdOriginal.get(id);
                } else {
                    query = {
                        updateOne: {
                            filter: {
                                "_id": this._userId
                            },
                            update: {
                                $push: {
                                    items: item
                                }
                            },
                            upsert: true
                        }
                    };

                    delta[id] = item.count;
                }

                this._itemsByIdOriginal.set(id, item.count);
                queries.push(query);
            }
        }

        // delete queries
        if (this._removedItems.size > 0) {
            for (let [id, item] of this._removedItems) {
                let deleteQuery = {
                    updateOne: {
                        filter: {
                            "_id": this._userId
                        },
                        update: {
                            $pull: {
                                items: {
                                    id: id
                                }
                            }
                        }
                    }
                };

                changes[id] = null;
                queries.push(deleteQuery);
                this._itemsByIdOriginal.delete(id);
            }
        }

        // update item id query
        let updateQuery = {
            updateOne: {
                filter: {
                    "_id": this._userId
                },
                update: {
                    $set: {
                        lastItemId: this._lastItemId,
                        currencies: this._currencies
                    }
                },
                upsert: true
            }
        };
        queries.push(updateQuery);

        await this._db.collection(Collections.Inventory).bulkWrite(queries);

        // reset 
        this._newItems.clear();
        this._removedItems.clear();

        Game.emitPlayerEvent(this._userId, Inventory.Changed, {
            changes,
            delta,
            currencies: this._currencies
        });
    }

    async addItemTemplates(templateRecords) {
        const length = templateRecords.length;

        if (length == 0) {
            return;
        }

        await this.loadAllItems();

        let templateIds = new Array(length);
        let itemQuantities = {};
        let elements = {};
        {
            let i = 0;
            for (; i < length; ++i) {
                templateIds[i] = templateRecords[i].item;
                itemQuantities[templateIds[i]] = templateRecords[i].quantity;
                elements[templateIds[i]] = templateRecords[i].element;
            }
        }

        let templatesLeft = templateIds.length;
        if (templatesLeft === 0) {
            return;
        }

        let templates = await Game.itemTemplates.getTemplates(templateIds);
        let i = 0;
        for (; i < length; ++i) {
            const template = templates[i];
            await this._addItemTemplate(template, itemQuantities[template._id], elements[template._id]);
        }
    }

    _addItemToIndexByTemplate(item) {
        this._getItemsByTemplate(item.template).push(item);
    }

    _deleteItemFromTemplateIndex(item) {
        let templates = this._getItemsByTemplate(item.template);
        let i = 0;
        const length = templates.length;
        for (; i < length; ++i) {
            if (templates[i].id == item.id) {
                templates[i] = templates[templates.length - 1];
                templates.pop();
                break;
            }
        }
    }

    getItemByTemplate(template) {
        let templates = this._getItemsByTemplate(template);
        return templates[0];
    }

    _getItemsByTemplate(template) {
        let templates = this._itemsByTemplate[template];
        if (!templates) {
            templates = [];
            this._itemsByTemplate[template] = templates;
        }

        return templates;
    }

    countItemsByTemplate(template, skipEquipped) {
        let templates = this._getItemsByTemplate(template);
        let count = 0;
        let i = 0;
        const length = templates.length;
        for (; i < length; ++i) {
            const item = templates[i];
            if (skipEquipped && item.equipped) {
                continue;
            }
            count += item.count;
        }

        return count;
    }

    async _addItemTemplate(template, count, element) {
        if (count <= 0) {
            return;
        }

        if (template.type == ItemType.Currency) {
            await this.modifyCurrency(template.currencyType, template.quantity * count);
            return;
        }

        let stacked = false;
        let templates = this._getItemsByTemplate(template._id);
        if (templates.length > 0) {
            let i = 0;
            const length = templates.length;
            for (; i < length; ++i) {
                let item = templates[i];
                if (item.unique || item.element != element) {
                    continue;
                }

                this.modifyStack(item, count);
                stacked = true;
                break;
            }
        }

        if (!stacked) {
            const item = this.createItemByTemplate(template, count);
            if (element) {
                item.element = element;
            }
            this.addItem(item);
        }

        await Game.rankings.updateRank(this._user.id, {
            type: RankingType.CollectedItemsByRarity,
            rarity: template.rarity,
            itemType: template.type
        }, count);
    }

    async addItemTemplate(template, quantity = 1, element) {
        await this.addItemTemplates([{
            item: template,
            quantity,
            element
        }]);
    }

    // add or modify item in collection
    addItem(item, forceNew = false) {
        if (!forceNew) {
            if (item.unique) {
                let foundItem = this.getItemById(item.id);
                if (foundItem) {
                    this.modifyStack(foundItem, item.count);
                    return foundItem;
                }
            } else {
                const templates = this._getItemsByTemplate(item.template);
                let i = 0;
                const length = templates.length;
                for (; i < length; ++i) {
                    const foundItem = templates[i];
                    if (!foundItem.unique && foundItem.element == item.element) {
                        this.modifyStack(foundItem, item.count);
                        return foundItem;
                    }
                }
            }
        }

        // add to list of items
        let newIndex = this._items.push(item) - 1;
        //add to index
        this._itemsById.set(item.id, newIndex);
        // mark as new 
        this._newItems.set(item.id, item);
        // check if is in deleted list
        this._removedItems.delete(item.id);
        this._addItemToIndexByTemplate(item);
        return item;
    }

    deleteItemById(id) {
        id *= 1;

        let itemIndex = this._itemsById.get(id);
        if (itemIndex === undefined) {
            return false;
        }

        let item = this._items[itemIndex];
        // swap with the last element and pop
        let lastItem = this._items[this._items.length - 1];
        this._items[itemIndex] = lastItem;
        this._items.pop();
        // mark as removed
        this._removedItems.set(item.id, item);
        // delete from new items
        this._newItems.delete(item.id);
        // delete from index
        this._itemsById.delete(item.id);
        this._deleteItemFromTemplateIndex(item);
        // set swapped item new index
        if (lastItem != item) {
            this._itemsById.set(lastItem.id, itemIndex);
        }


        return true;
    }

    removeItems(items) {    
        let index = 0;
        const length = items.length;
        for (; index < length; ++index) {
            const { item, count } = items[index];
            this._removeItem(item, count);
        }
    }

    removeItem(itemId, count = 1) {
        let item = this.getItemById(itemId);
        return this._removeItem(item, count);
    }

    _removeItem(item, count) {
        if (!item || item.count < count) {
            return 0;
        }

        this.modifyStack(item, -count);

        return count;
    }

    removeItemByTemplate(templateId, count = 1) {
        let templates = [...this._getItemsByTemplate(templateId)];
        const length = templates.length;

        if (length > 0) {
            for (let i = 0; i < length; ++i) {
                if (count == 0) {
                    break;
                }

                let item = templates[i];
                if (item.count >= count) {
                    this._removeItem(item, count);
                    count = 0;
                } else {
                    this.deleteItemById(item.id);
                    count -= item.count;
                }
            }
        }
    }

    async equipItem(item, equippedItems, holderId = -1) {
        const template = await Game.itemTemplates.getTemplate(item.template);
        const itemSlot = getSlot(template.equipmentType);

        await this.unequipItem(equippedItems[itemSlot]);
        await this.unequipItem(item);

        if (item.count > 1) {
            // split stack and create new item
            const copy = { ...item };
            copy.id = this.nextId
            copy.equipped = true;
            copy.count = 1;
            
            this.removeItem(item.id);
            item = this.addItem(copy, true);
        } else {
            item.equipped = true;
            this.setItemUpdated(item);
        }

        equippedItems[itemSlot] = item;
        item.holder = holderId;

        return item;
    }

    async unequipItem(item) {
        if (!item || !item.equipped) {
            return;
        }

        let equippedItems;
        let unit;
        // if holder is character use chracter items
        if (item.holder == UserHolder) {
            equippedItems = this._user.equipment;
        } else {
            unit = await Game.armyManager.getUnit(this._userId, item.holder);
            equippedItems = unit.items;
        }

        item.holder = UserHolder;
        item.equipped = false;

        let stacked = false;

        if (!item.unique) {
            let templates = this._getItemsByTemplate(item.template);
            // not unique, stack with existing template stack
            const length = templates.length;
            for (let i = 0; i < length; ++i) {
                const existingItem = templates[i];
                if (!existingItem.unique && existingItem.id != item.id) {
                    stacked = true;
                    this.removeItem(item.id);
                    this.modifyStack(existingItem, 1);
                    break;
                }
            }
        }

        if (!stacked) {
            item = this.getItemById(item.id);
            item.equipped = false;
            this.setItemUpdated(item);
        }

        const template = await Game.itemTemplates.getTemplate(item.template);
        const itemSlot = getSlot(template.equipmentType);

        delete equippedItems[itemSlot];
    

        if (unit) {
            await Game.armyManager.updateUnit(this._userId, unit)
        }
    }

    getItemById(id) {
        if (Array.isArray(id)) {
            const total = id.length;
            let items = new Array(total);
            let index = 0;
            
            for (; index < total; ++index) {
                items[index] = this._items[this._itemsById.get(id[index] * 1)];
            }
            return items;
        }

        id *= 1;
        // index -> item
        return this._items[this._itemsById.get(id)];
    }

    hasItems(template, count, skipEquipped = false) {
        return this.countItemsByTemplate(template, skipEquipped) >= count;
    }

    findWeapon(ingridient, items) {
        let foundItem;
        for (const ph of ingridient.placeholderItems) {
            if (items[ph] && (foundItem = this.getItemById(items[ph]))) {
                break;
            }
        }
        return foundItem;
    }

    async isMaxLevel(item) {
        const meta = await this.getMeta()
        const maxLevel = meta.itemLimitBreaks[item.rarity][2];
        return item.level == maxLevel;
    }

    async hasEnoughIngridients(ingridients) {
        let enoughResources = true;
        let i = 0;
        const length = ingridients.length;

        // NOTICE doesn't support max level items >1 quantity!
        for (; i < length; ++i) {
            let ingridient = ingridients[i];
            if (ingridient.placeholder) {
                continue;
            }

            if (!this.hasItems(ingridient.itemId, ingridient.quantity)) {
                enoughResources = false;
                break;
            }

            if (ingridient.maxLevelRequired) {
                let item = await this._getItemTemplateWithMaxLevel(ingridient.itemId);
                if (!item) {
                    enoughResources = false;
                    break;
                }
            }
        }

        return enoughResources;
    }

    async _getItemTemplateWithMaxLevel(template) {
        let templates = this._getItemsByTemplate(template);
        let k = 0;
        let l = templates.length;
        for (; k < l; ++k) {
            let item = templates[k];
            if (!item.unique) {
                continue;
            }

            if (this.isMaxLevel(item)) {
                return item;
            }
        }

        return null;
    }

    consumeIngridients(ingridients, items) {
        let i = 0;
        const length = ingridients.length;
        for (; i < length; ++i) {
            let ingridient = ingridients[i];
            if (ingridient.placeholder) {
                let foundItem = this.findItemPlaceholder(ingridient, items);
                this._removeItem(foundItem, ingridient.quantity);
            } else {
                this.removeItemByTemplate(ingridient.itemId, ingridient.quantity);
            }
        }
    }

    async consumeItemsFromCraftingRecipe(recipe, amount = 1) {
        let i = 0;
        const length = recipe.ingridients.length;
        for (; i < length; ++i) {
            let ingridient = recipe.ingridients[i];
            for (let j = 0; j < amount; ++j) {
                if (ingridient.placeholder) {
                    continue;
                }

                if (ingridient.maxLevelRequired) {
                    let item = await this._getItemTemplateWithMaxLevel(ingridient.itemId);
                    this._removeItem(item, ingridient.quantity);
                } else {
                    this.removeItemByTemplate(ingridient.itemId, ingridient.quantity);
                }
            }
        }
    }

    setItemUpdated(item) {   
        this._newItems.set(item.id, item);
    }

    modifyStack(item, inc) {
        if (isNaN(item.count)) {
            item.count = 0;
        }

        item.count += inc;

        if (item.count <= 0) {
            this.deleteItemById(item.id);
        } else {
            // mark as new
            this.setItemUpdated(item, true);
        }
    }

    makeUnique(item) {
        if (item.equipped) {
            item.unique = true;
            this.setItemUpdated(item);
            return item;
        }

        this.modifyStack(item, -1);

        const newItem = this.copyItem(item, 1);
        newItem.unique = true;
        this.addItem(newItem);
        return newItem;
    }

    copyItem(original, count) {
        const copy = { ...original };
        copy.id = this.nextId;
        copy.count = count;
        return copy;
    }

    createItemByTemplate(template, count = 1) {
        const item = {
            id: this.nextId,
            template: template._id * 1,
            count: count,
            level: 1,
            exp: 0,
            equipped: false,
            breakLimit: 0,
            unique: false
        }

        if (template.type == ItemType.Equipment) {
            item.rarity = template.rarity;

            const slot = getSlot(template.equipmentType);
            if (slot == EquipmentSlots.MainHand || slot == EquipmentSlots.OffHand) {
                item.element = Elements.Physical;
            }
        }

        return item;
    }

    async lockItem(itemId) {
        return this._setItemLocked(itemId, true);
    }

    async unlockItem(itemId) {
        return this._setItemLocked(itemId, false);
    }

    async _setItemLocked(itemId, isLocked) {
        const item = this.getItemById(itemId);

        if (!item) {
            throw Errors.NoItem;
        }

        
        // if holder is character use chracter items
        if (item.equipped) {
            let equippedItems;
            let unit;
            
            if (item.holder == UserHolder || item.holder === undefined) {
                equippedItems = this._user.equipment;
            } else {
                unit = await Game.armyManager.getUnit(this._userId, item.holder);
                equippedItems = unit.items;
            }

            const template = await Game.itemTemplates.getTemplate(item.template);
            const itemSlot = getSlot(template.equipmentType);

            if (equippedItems[itemSlot]) {
                equippedItems[itemSlot].locked = isLocked;
            }
        }
        
        
        item.locked = isLocked;
        this.setItemUpdated(item)
    }
}

module.exports = Inventory;
