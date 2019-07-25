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
                    totalWeight: "$stages.loot.totalWeight"
                }
            }])
            .toArray();


        if (!entries || entries.length === 0) {
            return null;
        }

        entries = entries[0];

        let items = {};
        while (itemsToRoll-- > 0) {
            let rolledItem = -1;

            //first no loot 
            let roll = Random.range(0, entries.totalWeight);
            if (roll <= entries.noLoot) {
                continue;
            }

            roll = Random.range(0, entries.totalWeight - entries.noLoot);
            for (let index = 0; index < entries.records.length; index++) {
                const record = entries.records[index];
                rolledItem = record.itemId;
                if (roll <= record.weight) {
                    break;
                }
            }

            if (rolledItem != -1) {
                if (!items[rolledItem]) {
                    items[rolledItem] = 1;
                } else {
                    items[rolledItem] += 1;
                }
            }
        }

        return items;
    }
}

module.exports = LootGenerator;