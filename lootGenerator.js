'use strict';

const {
    Collections
} = require("./database");
const Random = require("./random");
const bounds = require("binary-search-bounds");
import GachaType from "./knightlands-shared/gacha_type";

class LootGenerator {
    constructor(db) {
        this._db = db;
    }

    async getQuestLoot(zone, questIndex, stage, itemsToRoll = 1) {
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
                    noLoot: "$stages.loot.noLoot",
                    records: "$stages.loot.records",
                    guaranteedRecords: "$stages.loot.guaranteedRecords",
                    totalWeight: "$stages.loot.totalWeight"
                }
            }])
            .toArray();


        if (!entries || entries.length === 0) {
            return null;
        }

        return this._rollQuestLoot(itemsToRoll, entries[0]);
    }

    _rollQuestLoot(itemsToRoll, table) {
        let { items, itemsHash } = this._rollGuaranteedLootFromTable(table.guaranteedRecords);
        return this._rollItemsFromLootTable(itemsToRoll, table, table.weights, items, itemsHash);
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
            this._addLootToTable(items, itemsHash, record);
        }

        return {
            items,
            itemsHash
        }
    }

    _rollItemsFromLootTable(itemsToRoll, table, weights, items, itemsHash) {
        if (!items) {
            items = [];
        }

        if (!itemsHash) {
            itemsHash = {};
        }

        if (!weights) {
            weights = table.weights;
        }

        // items are ordered by weight - use binary search instead of linear search
        let comparator = (x, y) => {
            return weights.recordWeights[x.index] - y;
        };

        while (itemsToRoll-- > 0) {
            //first no loot 
            let roll = Random.range(0, weights.totalWeight);
            if (roll <= weights.noLoot) {
                continue;
            }

            roll = Random.range(0, weights.totalWeight - weights.noLoot);

            let rolledItem = bounds.gt(table.records, roll, comparator);

            if (rolledItem > 0) {
                this._addLootToTable(items, itemsHash, table.records[rolledItem]);
            }
        }

        return items;
    }

    async getLootFromGacha(gachaId) {
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
            items = this._drawFromNormalGacha(gacha);
        } else {

        }

        return items;
    }

    _drawFromNormalGacha(gacha) {
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

                this._rollItemsFromLootTable(quantity, group.loot, group.loot.weights, items, itemsHash);
            }
        }

        if (itemsPerDraw <= 0) {
            return items;
        }

        while (itemsPerDraw-- > 0) {
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

            this._rollItemsFromLootTable(1, rolledGroup.loot, rolledGroup.loot.weights, items, itemsHash);
        }

        return items;
    }

    _addLootToTable(items, hash, record) {
        let count = Math.ceil(Random.range(record.minCount, record.maxCount));
        if (!hash[record.itemId]) {
            let newItem = {
                item: record.itemId,
                quantity: count
            };
            hash[record.itemId] = newItem;
            items.push(newItem);
        } else {
            hash[record.itemId].quantity += count;
        }
    }
}

module.exports = LootGenerator;