'use strict';

const {
    Collections
} = require("./database");
const Random = require("./random");
const bounds = require("binary-search-bounds");
import GachaType from "./knightlands-shared/gacha_type";
const ItemType = require("./knightlands-shared/item_type");
import Game from "./game";

class LootGenerator {
    constructor(db) {
        this._db = db;
    }

    async getQuestLoot(zone, questIndex, stage, itemsToRoll = 0, questFinished = false) {
        let entries = await this._db
            .collection(Collections.QuestLoot)
            .aggregate([{
                $match: {
                    zone: zone
                }
            }, {
                $project: {
                    stages: {
                        $arrayElemAt: [{
                            $filter: {
                                input: {
                                    $arrayElemAt: ["$stages", stage]
                                },
                                as: "entry",
                                cond: {
                                    $in: [questIndex, "$$entry.quests"]
                                }
                            }
                        }, 0]
                    }
                }
            }, {
                $project: {
                    _id: 0,
                    records: "$stages.loot.records",
                    guaranteedRecords: "$stages.loot.guaranteedRecords",
                    weights: "$stages.loot.weights"
                }
            }])
            .toArray();


        if (!entries || entries.length === 0) {
            return null;
        }

        return await this._rollQuestLoot(itemsToRoll, entries[0], questFinished);
    }

    async getLootFromGacha(userId, gachaId) {
        let gacha;
        if (Number.isInteger(gachaId)) {
            gacha = await this._db.collection(Collections.GachaMeta).findOne({ _id: gachaId });
        } else {
            gacha = await this._db.collection(Collections.GachaMeta).findOne({ name: gachaId });
        }

        if (!gacha) {
            return {};
        }

        let items;

        if (gacha.type == GachaType.Normal) {
            items = await this._drawFromNormalGacha(userId, gacha);
        } else {
            // not implemented 
            items = [];
        }

        return items;
    }

    async getRaidLoot(raidLoot) {
        let { items, itemsHash } = this._rollGuaranteedLootFromTable(raidLoot.loot.guaranteedRecords);
        return await this._rollItemsFromLootTable(raidLoot.lootRolls, raidLoot.loot, raidLoot.loot.weights, items, itemsHash);
    }

    async getLootFromTable(table, itemsToRoll) {
        let { items, itemsHash } = this._rollGuaranteedLootFromTable(table.guaranteedRecords);
        return await this._rollItemsFromLootTable(itemsToRoll, table, table.weights, items, itemsHash);
    }

    async _rollQuestLoot(itemsToRoll, table, questFinished) {
        let items, itemsHash;

        if (questFinished && table.guaranteedRecords) {
            let rollResults = this._rollGuaranteedLootFromTable(table.guaranteedRecords);
            items = rollResults.items;
            itemsHash = rollResults.itemsHash;
        }

        if (!itemsToRoll) {
            itemsToRoll = table.itemsToRoll;
        }
        
        return await this._rollItemsFromLootTable(itemsToRoll, table, table.weights, items, itemsHash);
    }

    _rollGuaranteedLootFromTable(guaranteedRecords, items, itemsHash) {
        if (!items) {
            items = [];
        }

        if (!itemsHash) {
            itemsHash = {};
        }

        let i = 0;
        const length = guaranteedRecords.length;
        for (; i < length; i++) {
            let record = guaranteedRecords[i];
            this._addRecordToTable(items, itemsHash, record, true);
        }

        return {
            items,
            itemsHash
        }
    }

    async _rollItemsFromLootTable(itemsToRoll, table, weights, items, itemsHash, skipConsumables) {
        if (!items) {
            items = [];
        }

        if (!itemsHash) {
            itemsHash = {};
        }

        if (!table.records || table.records.length == 0) {
            return items;
        }

        if (!weights) {
            weights = table.weights;
        }

        // items are ordered by weight - use binary search instead of linear search
        let comparator = (x, y) => {
            return weights.recordWeights[x.index] - y;
        };

        while (itemsToRoll > 0) {
            itemsToRoll--;
            //first no loot 
            let roll = 0;
            if (weights.noLoot > 0) {
                roll = Random.range(0, weights.totalWeight)
                if (roll <= weights.noLoot) {
                    continue;
                }
            }

            roll = Random.range(weights.noLoot, weights.totalWeight);

            let rolledRecordIndex = bounds.gt(table.records, roll, comparator);
            if (rolledRecordIndex >= 0) {
                let lootRecord = table.records[rolledRecordIndex];

                if (lootRecord.table) {
                    // roll again from embedded loot table
                    lootRecord = await this._rollItemsFromLootTable(1, lootRecord.table, lootRecord.table.weights, [], {}, skipConsumables);
                    // returns array 
                    this._addLootToTable(items, itemsHash, lootRecord[0]);
                    // item already rolled at this point
                    continue;
                } else {
                    if (skipConsumables) {
                        let itemTemplate = await Game.itemTemplates.getTemplate(lootRecord.itemId);
                        if (itemTemplate.type == ItemType.Consumable) {
                            // skip and return back item roll
                            itemsToRoll++;
                            continue;
                        }
                    } 

                    this._addRecordToTable(items, itemsHash, lootRecord);
                }
            }
        }

        return items;
    }

    async _drawFromNormalGacha(userId, gacha) {
        let { items, itemsHash } = this._rollGuaranteedLootFromTable(gacha.guaranteedLoot);

        let itemsPerDraw = gacha.itemsPerDraw;
        // now roll guaranteed rarity groups
        {
            let i = 0;
            const length = gacha.rarityGuarantees.length;
            for (; i < length; ++i) {
                if (itemsPerDraw <= 0) {
                    break;
                }

                let rarityGroupRoll = gacha.rarityGuarantees[i];
                let group = gacha.rarityGroups[rarityGroupRoll.rarity];
                let quantity = rarityGroupRoll.quantity;

                // do not exceed items per draw
                if (itemsPerDraw < quantity) {
                    quantity = itemsPerDraw;
                }
                // count towards total item per draw
                itemsPerDraw -= quantity;
                
                // skip consumables for guaranteed rolls
                await this._rollItemsFromLootTable(quantity, group.loot, group.loot.weights, items, itemsHash, true);
            }
        }

        if (itemsPerDraw <= 0) {
            return items;
        }

        let basketRolls = 0;
        while (itemsPerDraw-- > 0) {
            if (gacha.basket) {
                if (gacha.basket.timesPerDraw > 0 && basketRolls < gacha.basket.timesPerDraw) {
                    basketRolls++
                    let rolled = await this._rollBasket(1, userId, gacha, items, itemsHash);
                    if (rolled) {
                        continue;
                    }
                }
            }

            // roll rarity group
            let roll = Random.range(0, gacha.totalWeight);
            roll = Random.range(0, gacha.totalWeight);
            let rolledGroup;
            for (let rarity in gacha.rarityGroups) {
                const group = gacha.rarityGroups[rarity];
                rolledGroup = group;
                if (roll <= group.weight) {
                    break;
                }
            }

            if (!rolledGroup) {
                continue;
            }

            await this._rollItemsFromLootTable(1, rolledGroup.loot, rolledGroup.loot.weights, items, itemsHash);
        }

        return items;
    }

    async _rollBasket(itemsToRoll, userId, gacha, items, itemsHash) {
        // get basket roll chance
        let gachaState = await this._db.collection(Collections.GachaState).findOne({ user: userId, gacha: gacha._id });
        if (!gachaState) {
            gachaState = {};
        }

        let basket = gacha.basket;

        let rollIndex = gachaState.rollIndex || 0;
        if (basket.weights.length <= rollIndex) {
            rollIndex = basket.weights.length - 1;
        }

        let basketWeight = basket.weights[rollIndex];
        if (Random.range(0, basket.basketNoDropWeight) > basketWeight) {
            return false;
        }

        while (itemsToRoll > 0) {
            itemsToRoll--;

            await this._rollItemsFromLootTable(1, basket.loot, basket.loot.weights, items, itemsHash);
        }

        await this._db.collection(Collections.GachaState).updateOne({ user: userId, gacha: gacha._id }, { $set: { rollIndex } }, { upsert: true });

        return true;
    }

    _addRecordToTable(items, hash, record, guaranteed = false) {
        let count = Math.ceil(Random.range(record.minCount, record.maxCount));

        let newItem = {
            item: record.itemId,
            quantity: count,
            guaranteed: guaranteed
        };

        this._addLootToTable(items, hash, newItem);
    }

    _addLootToTable(items, hash, loot) {
        if (!hash[loot.item]) {
            hash[loot.item] = loot;
            items.push(loot);
        } else {
            hash[loot.item].quantity += loot.quantity;
        }
    }
}

module.exports = LootGenerator;