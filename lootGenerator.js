'use strict';

const {
    Collections
} = require("./database");
import Random from "./random";
const bounds = require("binary-search-bounds");
import GachaType from "./knightlands-shared/gacha_type";
const ItemType = require("./knightlands-shared/item_type");
import Game from "./game";

class LootGenerator {
    constructor(db) {
        this._db = db;
    }

    async getQuestLoot(userId, zone, questIndex, stage, itemsToRoll = 0, questFinished = false) {
        let entries = await this._db
            .collection(Collections.QuestLoot)
            .aggregate([{
                $match: {
                    zone: zone
                }
            }, {
                $project: {
                    stages: {
                        $filter: {
                            input: {
                                $arrayElemAt: ["$stages", stage]
                            },
                            as: "entry",
                            cond: {
                                $in: [questIndex, "$$entry.quests"]
                            }
                        }
                    }
                }
            }, {
                $project: {
                    tables: {
                        $map: {
                            input: "$stages",
                            as: "stages",
                            in: {
                                _id: 0,
                                records: "$$stages.loot.records",
                                guaranteedRecords: "$$stages.loot.guaranteedRecords",
                                weights: "$$stages.loot.weights",
                                firstTimeRecords: "$$stages.loot.firstTimeRecords",
                                tag: "$$stages.loot.tag",
                                itemsToRoll: "$$stages.loot.itemsToRoll",
                                finishedLoot: "$$stages.loot.finishedLoot",
                            }
                        }
                    }
                }
            }])
            .toArray();


        if (!entries || entries.length === 0) {
            return null;
        }

        entries = entries[0].tables;

        let items = [];
        let itemsHash = {};

        for (let i = 0; i < entries.length; ++i) {
            let table = entries[i];

            if (questFinished && table.firstTimeRecords) {
                let lootQuery = {
                    address: userId
                };
                lootQuery[`firstTimeLoot.${zone}.${questIndex}`] = true;

                let isDropped = await this._db.collection(Collections.Users).findOne(lootQuery);
                if (!isDropped) {
                    let updateQuery = {$set:{}};
                    updateQuery.$set[`firstTimeLoot.${zone}.${questIndex}`] = true;

                    await this._db.collection(Collections.Users).updateOne({address: userId}, updateQuery);

                    this._rollGuaranteedLootFromTable(table.firstTimeRecords, table.tag, items, itemsHash);
                }   
            }

            await this._rollQuestLoot({
                itemsToRoll,
                zone,
                stage,
                isBoss: questIndex == 5 // right 6th quest is boss
            }, table, questFinished, items, itemsHash);
        }

        return items;
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

        return await this._drawFromGacha(userId, gacha, gacha.type == GachaType.Box);
    }

    async getRaidLoot(raidLoot) {
        let { items, itemsHash } = this._rollGuaranteedLootFromTable(raidLoot.loot.guaranteedRecords, raidLoot.loot.tag);
        return await this._rollItemsFromLootTable({
            itemsToRoll: raidLoot.lootRolls
        }, raidLoot.loot, raidLoot.loot.weights, items, itemsHash);
    }

    async getLootFromTable(table, itemsToRoll) {
        let { items, itemsHash } = this._rollGuaranteedLootFromTable(table.guaranteedRecords);
        return await this._rollItemsFromLootTable({
            itemsToRoll
        }, table, table.weights, items, itemsHash);
    }

    async _rollQuestLoot(lootContext, table, questFinished, items, itemsHash) {
        if (questFinished && table.guaranteedRecords) {
            let rollResults = await this._rollGuaranteedLootFromTable(table.guaranteedRecords, table.tag, items, itemsHash);
            items = rollResults.items;
            itemsHash = rollResults.itemsHash;
        }

        if (questFinished && table.finishedLoot) {
            table = table.finishedLoot;
        }

        if (lootContext.itemsToRoll == 0) {
            lootContext.itemsToRoll = table.itemsToRoll;
        }

        return await this._rollItemsFromLootTable(lootContext, table, table.weights, items, itemsHash);
    }

    async _rollGuaranteedLootFromTable(guaranteedRecords, tableTag, items, itemsHash) {
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
            await this._addRecordToTable({
                tableTag
            }, items, itemsHash, record, true);
        }

        return {
            items,
            itemsHash
        }
    }

    async _rollItemsFromLootTable(lootContext, table, weights, items, itemsHash, skipConsumables) {
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

        let itemsToRoll = lootContext.itemsToRoll;

        while (itemsToRoll > 0) {
            itemsToRoll--;
            //first no loot 
            let roll = 0;
            if (weights.noLoot > 0) {
                roll = Random.range(0, weights.totalWeight, true);
                if (roll <= weights.noLoot) {
                    continue;
                }
            }

            roll = Random.range(weights.noLoot, weights.totalWeight, true);
            let rolledRecordIndex = bounds.gt(table.records, roll, comparator);
            if (rolledRecordIndex >= 0) {
                let lootRecord = table.records[rolledRecordIndex];

                if (lootRecord.table) {
                    // roll again from embedded loot table
                    let newContext = {...lootContext};
                    newContext.itemsToRoll = 1;
                    lootRecord = await this._rollItemsFromLootTable(newContext, lootRecord.table, lootRecord.table.weights, [], {}, skipConsumables);
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
                    
                    lootContext.tableTag = table.tag;
                    await this._addRecordToTable(lootContext, items, itemsHash, lootRecord);
                }
            }
        }

        return items;
    }

    async _drawFromGacha(userId, gacha, isBox = false) {
        let { items, itemsHash } = await this._rollGuaranteedLootFromTable(gacha.guaranteedLoot);

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
                await this._rollItemsFromLootTable({
                    itemsToRoll: quantity
                }, group.loot, group.loot.weights, items, itemsHash, true);
            }
        }

        if (itemsPerDraw <= 0) {
            return items;
        }

        let totalWeight = gacha.totalWeight;
        let groupsWeights = gacha.rarityGroupsWeights;
        let gachaState = null;

        if (isBox) {
            gachaState = await this._getGachaState(userId, gacha);
            if (!gachaState) {
                gachaState = { totalWeight: totalWeight, rarityGroupsWeights: {...gacha.rarityGroupsWeights} };
            }

            totalWeight = gachaState.totalWeight;
            groupsWeights = gachaState.rarityGroupsWeights;
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
            let roll = Random.range(0, totalWeight, true);
            console.log(`rarity roll ${roll} ${totalWeight}` );

            let rolledGroup;
            for (let rarity in gacha.rarityGroups) {
                const group = gacha.rarityGroups[rarity];
                rolledGroup = group;
                console.log(`rarity weight ${groupsWeights[rarity]}`);
                if (roll <= groupsWeights[rarity]) {
                    break;
                }
            }

            if (!rolledGroup) {
                continue;
            }

            if (isBox) {
                // if rarityGroup has reset condition - reset initial state of the gacha
                if (rolledGroup.resetWeights) {
                    gachaState.rarityGroupsWeights = {...gacha.rarityGroupsWeights};
                    gachaState.totalWeight = gacha.totalWeight;
                } else {
                    // decrease current group weight
                    gachaState.rarityGroupsWeights[rolledGroup.rarity] -= rolledGroup.decreaseWeightOnRoll;
                    gachaState.totalWeight -= rolledGroup.decreaseWeightOnRoll;
                }
            }

            await this._rollItemsFromLootTable({
                itemsToRoll: 1
            }, rolledGroup.loot, rolledGroup.loot.weights, items, itemsHash);
        }

        if (isBox) {
            // if rarityGroup has reset condition - reset initial state of the gacha
            await this._setGachaState(userId, gacha, gachaState);
        }

        return items;
    }

    async _setGachaState(userId, gacha, state) {
        await this._db.collection(Collections.GachaState).updateOne({ user: userId, gacha: gacha._id }, { $set: state }, { upsert: true });
    }

    async _getGachaState(userId, gacha) {
        return await this._db.collection(Collections.GachaState).findOne({ user: userId, gacha: gacha._id });
    }
        
    async _rollBasket(itemsToRoll, userId, gacha, items, itemsHash) {
        // get basket roll chance
        let gachaState = await this._getGachaState(userId, gacha);
        if (!gachaState) {
            gachaState = {
                rollIndex: 0
            };
        }

        let basket = gacha.basket;

        let rollIndex = gachaState.rollIndex;
        if (basket.weights.length <= rollIndex) {
            rollIndex = basket.weights.length - 1;
        }

        let basketWeight = basket.weights[rollIndex];
        if (Random.range(0, basket.basketNoDropWeight, true) > basketWeight) {
            return false;
        }

        while (itemsToRoll > 0) {
            itemsToRoll--;

            await this._rollItemsFromLootTable({
                itemsToRoll: 1
            }, basket.loot, basket.loot.weights, items, itemsHash);
        }

        await this._setGachaState(userId, gacha, gachaState);

        return true;
    }

    async _addRecordToTable(lootContext, items, hash, record, guaranteed = false) {
        let dropModifier;

        if (lootContext.tableTag) {
            // try get drop amounts by table tag first 
            let dbRequest = { tableTag: lootContext.tableTag };
            if (lootContext.isBoss) {
                dbRequest.isBoss = lootContext.isBoss;
            }

            let modsRecord = await this._db.collection(Collections.DropZoneModifiers).findOne(dbRequest);
            if (!modsRecord) {
                // try item id
                dbRequest = { itemId: record.itemId };
                if (lootContext.isBoss) {
                    dbRequest.isBoss = lootContext.isBoss;
                }

                modsRecord = await this._db.collection(Collections.DropZoneModifiers).findOne(dbRequest);
            }

            if (modsRecord) {
                if (lootContext.zone) {
                    // extract modifier by zone and stage
                    let stageData = modsRecord.mods[lootContext.stage];
                    if (stageData && stageData.length > lootContext.zone) {
                        dropModifier = {
                            quantity: stageData[lootContext.zone],
                            spread: modsRecord.spread
                        };
                    }
                } else {
                    // extract modifier by stage only
                    dropModifier = modsRecord.mods[lootContext.stage];
                }
            }
        }

        let min = record.minCount;
        let max =  record.maxCount;

        if (dropModifier) {
            min = Math.ceil(dropModifier.quantity * (1 - dropModifier.spread));
            max = Math.ceil(dropModifier.quantity * (1 + dropModifier.spread));
        }

        let count = Math.round(Random.range(min, max, true));

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