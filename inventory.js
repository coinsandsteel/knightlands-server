'use strict';

const {
    Collections
} = require("./database");

import ItemType from "./knightlands-shared/item_type";
import Game from "./game";

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

        if (inventory.items) {
            this._items = inventory.items;
            this._lastItemId = inventory.lastItemId;

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
        await changeCallback(this);
        await this.commitChanges();
    }

    async commitChanges() {
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

                    this._itemsByIdOriginal.set(id, item.count);
                    delta[id] = item.count;
                }


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
                                    _id: id
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
            delta
        });
    }

    async addItemTemplates(templateRecords) {
        await this.loadAllItems();

        const length = templateRecords.length;
        let templateIds = new Array(length);
        {
            let i = 0;

            for (; i < length; ++i) {
                templateIds[i] = templateRecords[i].item;
            }
        }


        let templatesLeft = templateIds.length;
        if (templatesLeft === 0) {
            return;
        }

        let templates = await Game.itemTemplates.getTemplates(templateIds);

        let i = 0;
        for (; i < length; ++i) {
            this._addItemTemplate(templates[i], templateRecords[i].quantity);
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
            this.modifyCurrency(template.currencyType, template.quantity);
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
        } else {
            this.addItem(this.createItem(template._id, count));
        }
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
        if (item.count === 0) {
            this.deleteItemById(itemId);
        }

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
        // index -> item
        return this._items[this._itemsById.get(id)];
    }

    hasEnoughIngridients(ingridients) {
        let enoughResources = true;
        let i = 0;
        const length = ingridients.length;
        for (; i < length; ++i) {
            let ingridient = ingridients[i];
            if (!this._countItemsByTemplate(ingridient.itemId) < ingridient.quantity) {
                enoughResources = false;
                break;
            }
        }

        return enoughResources;
    }

    consumeItemsFromCraftingRecipe(recipe) {
        let i = 0;
        const length = recipe.ingridients.length;
        for (; i < length; ++i) {
            let ingridient = recipe.ingridients[i];
            this.removeItemByTemplate(ingridient.itemId, ingridient.quantity);
        }
    }

    modifyStack(item, inc) {
        item.count += inc;
        // mark as new
        this._newItems.set(item.id, item);
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