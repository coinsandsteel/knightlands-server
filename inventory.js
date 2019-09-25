'use strict';

const {
    Collections
} = require("./database");

import ItemType from "./knightlands-shared/item_type";
import Game from "./game";
import ItemProperties from "./knightlands-shared/item_properties";

class Inventory {
    constructor(userId, db) {
        this._db = db;
        this._userId = userId;
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

    static get Changed() {
        return "inventory_changed";
    }

    get info() {
        return {
            items: this._items,
            currencies: this._currencies
        }
    }

    getCurrency(currency) {
        return this._currencies[currency] || 0;
    }

    setCurrency(currency, value) {
        this._currencies[currency] = value * 1;
    }

    modifyCurrency(currency, value) {
        if (!this._currencies[currency]) {
            this.setCurrency(currency, value);
        } else {
            this._currencies[currency] += value * 1;
        }
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
                                $gt: [
                                    { $size: "$$item.properties" },
                                    0
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

        return items[0].items;
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
        {
            let i = 0;
            for (; i < length; ++i) {
                templateIds[i] = templateRecords[i].item;
                itemQuantities[templateIds[i]] = templateRecords[i].quantity;
            }
        }


        let templatesLeft = templateIds.length;
        if (templatesLeft === 0) {
            return;
        }

        let templates = await Game.itemTemplates.getTemplates(templateIds);
        let i = 0;
        for (; i < length; ++i) {
            this._addItemTemplate(templates[i], itemQuantities[templates[i]._id]);
        }
    }

    _addItemToIndexByTemplate(item) {
        this._getItemTemplates(item.template).push(item);
    }

    _deleteItemFromTemplateIndex(item) {
        let templates = this._getItemTemplates(item.template);
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
        let templates = this._getItemTemplates(template);
        return templates[0];
    }

    _getItemTemplates(template) {
        let templates = this._itemsByTemplate[template];
        if (!templates) {
            templates = [];
            this._itemsByTemplate[template] = templates;
        }

        return templates;
    }

    _countItemsByTemplate(template) {
        let templates = this._getItemTemplates(template);
        let count = 0;
        let i = 0;
        const length = templates.length;
        for (; i < length; ++i) {
            count += templates[i].count;
        }

        return count;
    }

    _addItemTemplate(template, count) {
        if (template.type == ItemType.Currency) {
            this.modifyCurrency(template.currencyType, template.quantity * count);
            return;
        }

        let templates = this._getItemTemplates(template._id);

        if (templates.length > 0) {
            let i = 0;
            const length = templates.length;
            for (; i < length; ++i) {
                let item = templates[i];
                if (item.unique) {
                    continue;
                }

                this.modifyStack(item, count);
                return;
            }
        }

        this.addItem(this.createItem(template._id, count));
    }

    async addItemTemplate(template) {
        await this.addItemTemplates([{
            item: template,
            quantity: 1
        }]);
    }

    // add or modify item in collection
    addItem(item) {
        let foundItem = this.getItemById(item.id);
        if (foundItem) {
            this.modifyStack(foundItem, item.count);
            return foundItem;
        } else {
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

    removeItem(itemId, count = 1) {
        let item = this.getItemById(itemId);
        if (!item || item.count < count) {
            return 0;
        }

        this.modifyStack(item, -count);

        return count;
    }

    removeItemByTemplate(templateId, count = 1) {
        let templates = this._getItemTemplates(templateId);
        if (templates.length > 0) {
            const length = templates.length;
            let i = 0;
            for (; i < length; ++i) {
                if (count == 0) {
                    break;
                }

                let item = templates[i];
                if (item.count >= count) {
                    this.removeItem(item.id, count);
                    count = 0;
                } else {
                    this.deleteItemById(item.id);
                    count -= item.count;
                }
            }
        }
    }

    getItemById(id) {
        id *= 1;
        // index -> item
        return this._items[this._itemsById.get(id)];
    }

    async hasEnoughIngridients(ingridients) {
        let enoughResources = true;
        let i = 0;
        const length = ingridients.length;
        let meta = await Game.db.collection(Collections.Meta).findOne({
            _id: "meta"
        });

        // NOTICE doesn't support max level items >1 quantity!
        for (; i < length; ++i) {
            let ingridient = ingridients[i];
            if (this._countItemsByTemplate(ingridient.itemId) < ingridient.quantity) {
                enoughResources = false;
                break;
            }

            if (ingridient.maxLevelRequired) {
                let item = await this._getItemTemplateWithMaxLevel(ingridient.itemId, meta);
                if (!item) {
                    break;
                }
            }
        }

        return enoughResources;
    }

    async _getItemTemplateWithMaxLevel(template, meta) {
        let templates = this._getItemTemplates(template);
        let k = 0;
        let l = templates.length;
        for (; k < l; ++k) {
            let item = templates[k];
            if (!item.unique) {
                continue;
            }

            let itemTemplate = await Game.db.itemTemplates.getTemplate(item.template);
            let maxLevel = meta.itemLimitBreaks[itemTemplate.rarity][2];
            if (item.level == maxLevel) {
                return item;
            }
        }

        return null;
    }

    consumeIngridients(ingridients) {
        let i = 0;
        const length = ingridients.length;
        for (; i < length; ++i) {
            let ingridient = ingridients[i];
            this.removeItemByTemplate(ingridient.itemId, ingridient.quantity);
        }
    }

    async consumeItemsFromCraftingRecipe(recipe) {
        let i = 0;
        const length = recipe.ingridients.length;
        for (; i < length; ++i) {
            let ingridient = recipe.ingridients[i];
            if (ingridient.maxLevelRequired) {
                let item = await this._getItemTemplateWithMaxLevel(ingridient.itemId);
                this.deleteItemById(item.id);
            } else {
                this.removeItemByTemplate(ingridient.itemId, ingridient.quantity);
            }
        }
    }

    setItemUpdated(item) {
        this._newItems.set(item.id, item);
    }

    modifyStack(item, inc) {
        item.count += inc;

        if (item.count === 0) {
            this.deleteItemById(item.id);
        } else {
            // mark as new
            this.setItemUpdated(item);
        }
    }

    makeUnique(item) {
        if (item.count > 1) {
            this.modifyStack(item, -1);

            item = this.createItem(item.template, 1);
            this.addItem(item);
        } else {
            // mark as new to update later
            this.setItemUpdated(item);
        }

        item.unique = true;
        return item;
    }


    // bulk items request by field name.
    // async getItems(itemIds, fieldName = "_id", excludeFieldName = "unique", excludeFields = []) {
    //     if (!Array.isArray(itemIds)) {
    //         itemIds = [itemIds];
    //     }

    //     let entries = await this._db
    //         .collection(Collections.Inventory)
    //         .aggregate([{
    //             $match: {
    //                 _id: "test"
    //             }
    //         }, {
    //             $project: {
    //                 items: {
    //                     $filter: {
    //                         input: "$items",
    //                         as: "item",
    //                         cond: {
    //                             $in: [`$$item.${fieldName}`, itemIds],
    //                             $not: {
    //                                 $in: [`$$item.${excludeFieldName}`, excludeFields]
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }, {
    //             $project: {
    //                 _id: 0
    //             }
    //         }])
    //         .toArray();
    //     return entries;
    // }

    createItem(templateId, count = 0) {
        return {
            id: this.nextId,
            template: templateId * 1,
            count: count,
            level: 1,
            exp: 0,
            equipped: false,
            breakLimit: 0,
            unique: false
        };
    }
}

module.exports = Inventory;