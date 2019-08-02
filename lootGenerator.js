const {
    Collections
} = require("./database");
const Random = require("./random");

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

        entries = entries[0];

        let items = {}; {
            let i = 0;
            const length = entries.guaranteedRecords.length;
            for (; i < length; i++) {
                let record = entries.guaranteedRecords[i];
                this._addLootToTable(items, record);
            }
        }

        while (itemsToRoll-- > 0) {
            let rolledItem;

            //first no loot 
            let roll = Random.range(0, entries.totalWeight);
            if (roll <= entries.noLoot) {
                continue;
            }

            roll = Random.range(0, entries.totalWeight - entries.noLoot);
            for (let index = 0; index < entries.records.length; index++) {
                const record = entries.records[index];
                rolledItem = record;
                if (roll <= record.weight) {
                    break;
                }
            }

            if (rolledItem) {
                this._addLootToTable(items, rolledItem);
            }
        }

        console.log(items);

        return items;
    }

    _addLootToTable(items, record) {
        let count = Math.ceil(Random.range(record.minCount, record.maxCount));
        if (!items[record.itemId]) {
            items[record.itemId] = count;
        } else {
            items[record.itemId] += count;
        }
    }
}

module.exports = LootGenerator;