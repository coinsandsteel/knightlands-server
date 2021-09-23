'use strict';

const {
    Collections
} = require("./database/database");
import Random from "./random";
const bounds = require("binary-search-bounds");
import GachaType from "./knightlands-shared/gacha_type";
const ItemType = require("./knightlands-shared/item_type");
import Game from "./game";
import Errors from "./knightlands-shared/errors";
import CharacterStat from "./knightlands-shared/character_stat";
const Events = require("./knightlands-shared/events");

class LootGenerator {
    constructor(db) {
        this._db = db;
    }

    async init() {
        this._luckLoot = await this._db.collection(Collections.QuestLoot).findOne({ _id: "luck_loot" })
    }

    async openChest(user, chestId, count, free = false) {
        let items = await Game.lootGenerator.getLootFromGacha(user.address, chestId, count);

        await user.inventory.autoCommitChanges(async inv => {
            await inv.addItemTemplates(items);
        });

        if (!free) {
            // TODO ugly, move to configuration
            if (chestId == "silver_chest") {
                await user.dailyQuests.onChestOpened(count, false);
            } else if (chestId == "velvet_chest") {
                await user.dailyQuests.onChestOpened(count, true);
            }
        }

        return items;
    }

    async _openChest(userId, chestId, count) {
        let user = await Game.getUser(userId);
        return await this.openChest(user, chestId, count);
    }

    async getQuestLoot(userId, zone, questIndex, isBoss, stage, itemsToRoll = 0, questFinished = false, luck = 0) {
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
                    let updateQuery = { $set: {} };
                    updateQuery.$set[`firstTimeLoot.${zone}.${questIndex}`] = true;

                    await this._db.collection(Collections.Users).updateOne({ address: userId }, updateQuery);

                    const length = table.firstTimeRecords.length;
                    for (let j = 0; j < length; ++j) {
                        const record = table.firstTimeRecords[j];
                        if (record.table) {
                            await this._rollItemsFromLootTable({}, record.table, null, items, itemsHash, false);
                        } else {
                            await this._addRecordToTable({
                                tableTag: table.tag
                            }, items, itemsHash, record, true);
                        }
                    }
                }
            }

            await this._rollQuestLoot({
                itemsToRoll,
                zone,
                stage,
                isBoss
            }, table, questFinished, items, itemsHash, luck);
        }


        let user = await Game.getUser(userId);

        for (let k = 0; k < itemsToRoll; ++k) {
            // check drop options
            await this._extraDrops({ items, userId, itemsHash, itemsToRoll, user })
                // check luck rolls
            await this._rollLuckDrops({ items, userId, stage, itemsHash, itemsToRoll, user });
        }

        return items;
    }

    async getLootFromGacha(userId, gachaId, count = 1) {
        let gacha;
        if (Number.isInteger(gachaId)) {
            gacha = await this._db.collection(Collections.GachaMeta).findOne({ _id: gachaId });
        } else {
            gacha = await this._db.collection(Collections.GachaMeta).findOne({ name: gachaId });
        }

        if (!gacha) {
            return {};
        }

        return await this._drawFromGacha(userId, gacha, count, gacha.type == GachaType.Box);
    }

    async getRaidLoot(raidLoot) {
        let { items, itemsHash } = await this._rollGuaranteedLootFromTable(raidLoot.loot.guaranteedRecords, raidLoot.loot.tag);
        return await this._rollItemsFromLootTable({
            itemsToRoll: raidLoot.lootRolls
        }, raidLoot.loot, raidLoot.loot.weights, items, itemsHash);
    }

    async getLootFromTable(table, itemsToRoll, lootCount = 1) {
        let { items, itemsHash } = await this._rollGuaranteedLootFromTable(table.guaranteedRecords, null, null, null, lootCount);
        return await this._rollItemsFromLootTable({
            itemsToRoll,
            lootCount
        }, table, table.weights, items, itemsHash);
    }

    async _extraDrops({ items, itemsHash, user }) {
        const byItem = user.maxStats[CharacterStat.DropItemQuest];
        for (const itemId in byItem) {
            const roll = Random.range(0, 1, true);
            if (roll <= byItem[itemId]) {
                this._addLootToTable(items, itemsHash, {
                    quantity: 1,
                    item: +itemId,
                    guaranteed: false
                })
            }
        }
    }

    async _rollLuckDrops({ items, itemsHash, stage, user }) {
        const stageLoot = this._luckLoot[stage]
            // if user has minimum required luck
        const userLuck = user.getMaxStatValue(CharacterStat.Luck);

        for (let i = stageLoot.length - 1; i >= 0; --i) {
            // we assume that luck requirements are in ascending order
            let table = stageLoot[i];
            if (userLuck >= table.minLuck) {
                await this._rollItemsFromLootTable({}, table, table.weights, items, itemsHash);
                break;
            }
        }
    }

    async _rollQuestLoot(lootContext, table, questFinished, items, itemsHash, luck) {
        if (questFinished && table.finishedLoot) {
            table = table.finishedLoot;
        }

        const rollResults = await this._rollGuaranteedLootFromTable(table.guaranteedRecords, table.tag, items, itemsHash);
        items = rollResults.items;
        itemsHash = rollResults.itemsHash;

        if (lootContext.itemsToRoll == 0) {
            lootContext.itemsToRoll = table.itemsToRoll;
        }

        return await this._rollItemsFromLootTable(lootContext, table, table.weights, items, itemsHash, false, luck);
    }

    async _rollGuaranteedLootFromTable(guaranteedRecords, tableTag, items, itemsHash, lootCount) {
        if (!items) {
            items = [];
        }

        if (!itemsHash) {
            itemsHash = {};
        }

        if (guaranteedRecords && Array.isArray(guaranteedRecords)) {
            let i = 0;
            const length = guaranteedRecords.length;
            for (; i < length; i++) {
                let record = guaranteedRecords[i];
                await this._addRecordToTable({
                    tableTag
                }, items, itemsHash, record, true, lootCount);
            }
        }

        return {
            items,
            itemsHash
        }
    }

    async _rollItemsFromLootTable(lootContext, table, weights, items, itemsHash, skipConsumables, luck = 0) {
        if (!items) {
            items = [];
        }

        if (!itemsHash) {
            itemsHash = {};
        }

        if (!table.records || table.records.length == 0) {
            return items;
        }

        if (!lootContext) {
            lootContext = {};
        }

        if (!weights) {
            weights = table.weights;
        }

        // items are ordered by weight - use binary search instead of linear search
        let comparator = (x, y) => {
            return weights.recordWeights[x.index] - y;
        };

        let itemsToRoll = lootContext.itemsToRoll;
        if (!itemsToRoll) {
            itemsToRoll = table.itemsToRoll;
        }

        if (!itemsToRoll) {
            itemsToRoll = 1;
        }

        if (lootContext.lootCount) {
            itemsToRoll *= lootContext.lootCount;
        }

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
                    let newContext = {...lootContext };
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
                            // skip and reroll
                            itemsToRoll++;
                            continue;
                        }
                    } else if (lootRecord.luckRequired > luck) {
                        // reroll
                        itemsToRoll++;
                        continue;
                    }

                    lootContext.tableTag = table.tag;
                    await this._addRecordToTable(lootContext, items, itemsHash, lootRecord);
                }
            }
        }

        return items;
    }

    async _drawFromGacha(userId, gacha, count, isBox = false) {
        let { items, itemsHash } = await this._rollGuaranteedLootFromTable(gacha.guaranteedLoot);

        let itemsPerDraw = gacha.itemsPerDraw * count;
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
                gachaState = { totalWeight: totalWeight, rarityGroupsWeights: {...gacha.rarityGroupsWeights } };
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
            // console.log(`rarity roll ${roll} ${totalWeight}` );

            let rolledGroup;
            for (let rarity in gacha.rarityGroups) {
                const group = gacha.rarityGroups[rarity];
                rolledGroup = group;
                // console.log(`roll ${roll} <= rarity weight ${groupsWeights[rarity]}`);
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
                    gachaState.rarityGroupsWeights = {...gacha.rarityGroupsWeights };
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

    async _addRecordToTable(lootContext, items, hash, record, guaranteed = false, lootCount = 1) {
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

        let min = record.minCount * lootCount;
        let max = record.maxCount * lootCount;

        if (dropModifier) {
            min = Math.ceil(dropModifier.quantity * (1 - dropModifier.spread));
            max = Math.ceil(dropModifier.quantity * (1 + dropModifier.spread));
        }

        let count = Math.round(Random.range(min, max, true));

        if (count > 0) {
            const newItem = {
                item: record.itemId,
                quantity: count,
                guaranteed: guaranteed
            };

            this._addLootToTable(items, hash, newItem);
        }
    }

    rollLootRecord(record) {
        let min = record.minCount;
        let max = record.maxCount;
        let count = Math.round(Random.range(min, max, true));

        return {
            item: record.itemId,
            quantity: count
        };
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