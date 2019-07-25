const {
    Collections
} = require("./database");

class Inventory {
    constructor(userId, db) {
        this._db = db;
        this._userId = userId;
        this._items = [];
        this._itemsById = new Map(); // keeps index in items array
        this._itemsByIdOriginal = new Map(); // original copy to detect changes
        this._lastItemId = 0;

        // keep track of changes to commit later
        this._removedItems = new Map();
        this._newItems = new Map();
    }

    get nextId() {
        return ++this._lastItemId;
    }

    async loadAllItems() {
        if (this._items.length === 0) {
            let inventory = await this._db.collection(Collections.Inventory).findOne({
                _id: this._userId
            });

            if (inventory && inventory.items) {
                this._items = inventory.items;
                this._lastItemId = inventory.lastItemId;

                // build index 
                let i = 0;
                const length = this._items.length;
                for (; i < length; i++) {
                    let item = this._items[i];
                    this._itemsById.set(item.id, i);
                    this._itemsByIdOriginal.set(item.id, item.count);
                }
            }
        }

        return this._items;
    }

    async commitChanges() {
        let changes = {};

        let queries = [];
        // update/insert queries
        if (this._newItems.size > 0) {
            // replace queries 
            for (let [id, item] of this._newItems) {
                let query;

                changes[id] = {
                    ...item
                };

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
                    changes[id].count = item.count - this._itemsByIdOriginal.get(id);
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

                    this._itemsByIdOriginal.set(id, true);

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
                        lastItemId: this._lastItemId
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

        return changes;
    }

    addItemTemplates(templates) {
        let templatesLeft = Object.keys(templates).length;
        if (templatesLeft === 0) {
            return;
        }

        // get non-unique versions of items with templates
        let i = 0;
        const length = this._items.length;
        for (; i < length; i++) {
            let item = this._items[i];
            if (!templates[item.template]) {
                continue;
            }

            this.modifyStack(item, templates[item.template]);
            // safe to assume that without unique items, there is always 1 stack of particular item with desired template
            templatesLeft--;
            templates[item.template] = undefined;
        }

        if (templatesLeft > 0) {
            // add new items with templates
            for (let template in templates) {
                if (templates[template]) {
                    this.addItem(this.createItem(template, templates[template]));
                }
            }
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
        this._items[itemIndex] = this._items[this._items.length - 1];
        this._items.pop();
        // mark as removed
        this._removedItems.set(item.id, item);
        // delete from new items
        this._newItems.delete(item.id);
        // delete from index
        this._itemsById.delete(item.id);

        return true;
    }

    removeItem(itemId, count = 1) {
        let item = this.getItemById(itemId);
        if (!item || item.count < count) {
            return false;
        }

        this.modifyStack(item, -count);
        if (item.count === 0) {
            this.deleteItemById(itemId);
        }

        return true;
    }

    getItemById(id) {
        // index -> item
        return this._items[this._itemsById.get(id)];
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

    async getTemplate(templateId) {
        return await this._db.collection(Collections.Items).findOne({
            _id: templateId
        });
    }

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