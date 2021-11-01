'use strict';

const {
    Collections
} = require("../database/database");

const Raid = require("./raid");
import Elements from "../knightlands-shared/elements";
const EquipmentType = require("../knightlands-shared/equipment_type");
import Game from "../game";
import { ObjectId } from "mongodb";
import Errors from "../knightlands-shared/errors";
import random from "../random";
import CharacterStat from "../knightlands-shared/character_stat";
import { isNumber } from "../validation";

const WeaknessRotationCycle = 86400000 * 7; // 7 days
const ElementalWeakness = [Elements.Water, Elements.Earth, Elements.Light, Elements.Darkness];
const WeaponWeaknesses = [EquipmentType.Axe, EquipmentType.Sword, EquipmentType.Bow, EquipmentType.Wand, EquipmentType.Spear];

const DktFactorUpdateInterval = 1800000; // every 30 minutes
// const DktFactorUpdateInterval = 10000; // every 10 seconds
const DKT_RESTORE_FACTOR = 0.05;
const RAIDS_PER_PAGE = 20;
const FINISHED_RAID_CACHE_TTL = 3600000; // 1 hour

class RaidManager {
    constructor(db, paymentProcessor) {
        this.SummonPaymentTag = "raid_summon";
        this.JoinPaymentTag = "raid_join";

        this._db = db;
        this._factors = {};
        this._paymentProcessor = paymentProcessor;
    }

    async init() {
        let settings = await this._db.collection(Collections.RaidsDktMeta).find({}).toArray();
        let meta = await this._db.collection(Collections.RaidsDktMeta).find({}).toArray();

        this._factorSettings = {};
        settings.forEach(setting => {
            this._factorSettings[setting.stage] = setting;
        });

        // load all running raids
        let raids = await this._db.collection(Collections.Raids).find({
            finished: false
        }).toArray();

        this._raids = {};
        this._finishedRaids = {};

        let i = 0;
        const length = raids.length;
        for (; i < length; i++) {
            let raidData = raids[i];
            let raid = new Raid(this._db);
            await raid.init(raidData);
            this._addRaid(raid);
        }

        await this._updateWeaknesses(true);
        // await this._restoreDktForAllRaids(true);
        this._scheduleWeaknessUpdate();
    }

    async fetchPlayersFromRaid(raidId) {
        let raid = this.getRaid(raidId);
        if (!raid || raid.free) {
            throw Errors.InvalidRaid;
        }

        return raid.getPlayers();
    }

    async joinRaid(userId, raidId) {
        let raid = this.getRaid(raidId);
        if (!raid || raid.free) {
            throw Errors.InvalidRaid;
        }

        if (raid.isFull) {
            throw Errors.RaidIsFull;
        }

        if (raid.isParticipant(userId.toHexString())) {
            throw Errors.InvalidRaid;
        }

        const user = await Game.getUserById(userId);
        const raitTemplate = await this._loadRaidTemplate(raid.templateId);

        if (user.level < raitTemplate.level) {
            throw Errors.NotEnoughLevel;
        }

        if (user.getTimerValue(CharacterStat.Stamina) < raid.template.summonPrice) {
            throw Errors.IncorrectArguments;
        }

        let recipe;

        if (!user.isFreeAccount) {
            recipe = await this._loadSummonRecipe(raid.template.joinRecipe);
        }

        if (recipe) {
            if (!(await user.inventory.hasEnoughIngridients(recipe.ingridients))) {
                throw Errors.NoRecipeIngridients;
            }

            await user.autoCommitChanges(async() => {
                // consume crafting materials
                await user.inventory.consumeItemsFromCraftingRecipe(recipe);
            });
        }

        await user.modifyTimerValue(CharacterStat.Stamina, -raid.template.summonPrice);

        await user.dailyQuests.onPaidRaidJoin();
        await raid.join(user.id.toHexString());

        if (raid.isFull) {
            Game.publishToChannel("public_raids", { full: raid.id });
        }
    }

    async summonRaid(summoner, raidTemplateId, free, isPublic, allowFreePlayers) {
        let raitTemplate = await this._loadRaidTemplate(raidTemplateId);

        if (!raitTemplate) {
            throw Errors.InvalidRaid;
        }

        if (summoner.level < raitTemplate.level) {
            throw Errors.NotEnoughLevel;
        }

        // check if there is enough crafting materials
        let data = (free || summoner.isFreeAccount) ? raitTemplate.soloData : raitTemplate.data;

        if (summoner.getTimerValue(CharacterStat.Stamina) < data.summonPrice) {
            throw Errors.IncorrectArguments;
        }

        if (!free && !summoner.isFreeAccount) {
            const summonRecipe = await this._loadSummonRecipe(data.summonRecipe);

            if (!(await summoner.inventory.hasEnoughIngridients(summonRecipe.ingridients))) {
                throw Errors.NoRecipeIngridients;
            }

            await summoner.inventory.consumeItemsFromCraftingRecipe(summonRecipe);
        }

        await summoner.modifyTimerValue(CharacterStat.Stamina, -data.summonPrice);

        const raid = new Raid(this._db);
        await raid.create(summoner.id, raidTemplateId, free, isPublic);
        this._addRaid(raid);

        if (!free) {
            await summoner.dailyQuests.onPaidRaidJoin();

            if (isPublic) {
                Game.publishToChannel("public_raids", { raid: raid.getInfo() });
            }
        }

        return {
            raid: raid.id
        };
    }

    async fetchPublicRaids(userId, userLevel, page) {
        let matchQuery = {
            $match: {
                finished: false,
                isFree: false,
                public: true,
                [`participants.${userId}`]: { $exists: false },
                $and: [
                    { $expr: { $lt: ["$busySlots", "$maxSlots"] } },
                    { $expr: { $lte: ["$level", userLevel] } }
                ]
            }
        };
        return await this._db.collection(Collections.Raids).aggregate([
            matchQuery,
            {
                "$addFields": {
                    "id": { "$toString": "$_id" }
                }
            },
            { $sort: { level: -1 } },
            { $skip: page * RAIDS_PER_PAGE },
            { $limit: RAIDS_PER_PAGE },
            {
                $project: {
                    raidTemplateId: 1,
                    timeLeft: 1,
                    busySlots: 1,
                    bossState: 1,
                    finished: 1,
                    id: 1,
                    isFree: 1,
                    _id: 0,
                    participants: 1,
                    weakness: 1
                }
            }
        ]).toArray();
    }

    async fetchRaidCurrentMeta(userId, raidTemplateId, isFree) {
        if (!isNumber(raidTemplateId)) {
            throw Errors.IncorrectArguments;
        }

        let info = {
            isFirst: false,
            weakness: null,
            dktFactor: null
        };

        if (isFree) {
            const firstClearance = await this._db.collection(Collections.FreeRaidsClearance).findOne({ raidId: +raidTemplateId, user: userId });
            info.isFirst = !!firstClearance;
        }

        // info.dktFactor = await this._getNextDktFactor(raidTemplateId, true);
        info.weakness = await this._db.collection(Collections.RaidsWeaknessRotations).findOne({ raid: +raidTemplateId });
        info.weakness.untilNextWeakness = WeaknessRotationCycle - Game.now % WeaknessRotationCycle;
        return info;
    }

    async getRaidInfo(userId, raidId) {
        let raid = await this._db.collection(Collections.Raids).aggregate([{
                $match: {
                    _id: new ObjectId(raidId)
                }
            },
            {
                "$addFields": {
                    "id": { "$toString": "$_id" },
                    "currentDamage": `$participants.${userId}`
                }
            },
            {
                $project: {
                    _id: 0
                }
            }
        ]).toArray();

        if (raid.length == 0) {
            throw "no such raid";
        }

        let info = raid[0];

        if (info.isFree) {
            const firstClearance = await this._db.collection(Collections.FreeRaidsClearance).findOne({ raidId: +info.raidTemplateId, user: userId });
            info.isFirst = !!firstClearance;
        }

        info.weakness.untilNextWeakness = WeaknessRotationCycle - Game.now % WeaknessRotationCycle;
        // info.dktFactor = await this._getNextDktFactor(info.raidTemplateId, true);
        return info;
    }

    _getActiveRaidsQuery(userId) {
        let lootQuery = {};
        lootQuery[`loot.${userId}`] = { $ne: true };
        return {
            $or: [{
                    $and: [lootQuery, { defeat: true }]
                },
                {
                    finished: false
                }
            ],
            [`participants.${userId}`]: { $exists: true }
        };
    }

    async getCurrentRaids(userId) {
        return await this._db.collection(Collections.Raids).aggregate([
            { $match: this._getActiveRaidsQuery(userId) },
            {
                "$addFields": {
                    "id": { "$toString": "$_id" }
                }
            },
            {
                $project: {
                    raidTemplateId: 1,
                    timeLeft: 1,
                    busySlots: 1,
                    bossState: 1,
                    finished: 1,
                    id: 1,
                    isFree: 1,
                    _id: 0,
                    participants: 1,
                    weakness: 1
                }
            }
        ]).toArray();
    }

    async activeRaidsCount(userId) {
        return await this._db.collection(Collections.Raids).count(this._getActiveRaidsQuery(userId));
    }

    async _loadRaidTemplate(raidTemplateId) {
        return await this._db.collection(Collections.RaidsMeta).findOne({
            _id: raidTemplateId * 1
        });
    }

    async _loadSummonRecipe(summonRecipe) {
        return await this._db.collection(Collections.CraftingRecipes).findOne({
            _id: summonRecipe
        });
    }

    getRaid(raidId) {
        return this._getRaid(raidId);
    }

    _getRaid(raidId) {
        if (!this._raids[raidId]) {

        }
        return this._raids[raidId];
    }

    _addRaid(raid) {
        this._raids[raid.id] = raid;

        raid.on(raid.TimeRanOut, this._handleRaidTimeout.bind(this));
        raid.on(raid.Defeat, this._handleRaidDefeat.bind(this));
    }

    async _handleRaidTimeout(raid) {
        // fix dkt rate
        await raid.finish(0);
        this._removeRaid(raid.id);
    }

    async _handleRaidDefeat(raid) {
        let dktFactor = 0;

        if (raid.free) {
            const user = await Game.getUserById(raid.summoner);
            await user.dailyQuests.onFreeRaidFinished();
        }

        await raid.finish(dktFactor);
        this._removeRaid(raid.id);

        if (raid.isPublic) {
            Game.publishToChannel("public_raids", { full: raid.id });
        }
    }

    _removeRaid(id) {
        delete this._raids[id];
    }

    async claimLoot(user, raidId) {
        let raid = await this._getFinishedRaid(user.id, raidId);
        return await raid.claimLoot(user);
    }

    async getLootPreview(user, raidId) {
        let raid = await this._getFinishedRaid(user.id, raidId);
        return await raid.getRewards(user);
    }

    async _getFinishedRaid(userId, raidId) {
        let raid = this._finishedRaids[raidId];

        if (!raid) {
            let matchQuery = {
                $match: {
                    _id: new ObjectId(raidId),
                    finished: true,
                    defeat: true
                }
            };

            let participantId = `participants.${userId}`;
            let lootId = `loot.${userId}`;
            matchQuery.$match[participantId] = { $exists: true };
            matchQuery.$match[lootId] = { $ne: true };

            let raidData = await this._db.collection(Collections.Raids).aggregate([
                matchQuery
            ]).toArray();

            if (!raidData || raidData.length == 0) {
                throw Errors.InvalidRaid;
            }

            raidData = raidData[0];

            raid = new Raid(this._db);
            await raid.init(raidData);

            // TODO implement proper caching
            this._finishedRaids[raidId] = raid;
        }

        return raid;
    }

    _scheduleWeaknessUpdate() {
        setTimeout(async() => {
            try {
                await this._updateWeaknesses();
            } finally {
                this._scheduleWeaknessUpdate();
            }
        }, WeaknessRotationCycle - Game.now % WeaknessRotationCycle);
    }

    async _updateWeaknesses(onlyMissing = false) {
        // get all raid templates, assign next weaknesses and generate next day weakneses
        let allRaids = await this._db.collection(Collections.RaidsMeta).find({}).toArray();
        let allRaidsWeaknesses = await this._db.collection(Collections.RaidsWeaknessRotations).find({}).toArray();

        const weaknessLookup = {}; {
            const length = allRaidsWeaknesses.length;
            for (let i = 0; i < length; i++) {
                const weakness = allRaidsWeaknesses[i];
                weaknessLookup[weakness.raid] = weakness;
            }
        }

        let queries = [];
        const length = allRaids.length;
        for (let i = 0; i < length; i++) {
            const raidTemplate = allRaids[i];
            let missing = false;
            let weakness = weaknessLookup[raidTemplate._id];
            if (weakness) {
                weakness.current = weakness.next;
                weakness.next = this._rollRaidWeaknesses();
            } else {
                weakness = {
                    current: this._rollRaidWeaknesses(),
                    next: this._rollRaidWeaknesses(),
                    raid: raidTemplate._id
                };
                weaknessLookup[raidTemplate._id] = weakness;
                missing = true;
            }

            if ((onlyMissing && missing) || !onlyMissing) {
                queries.push({
                    updateOne: {
                        filter: {
                            raid: weakness.raid
                        },
                        update: {
                            $set: weakness
                        },
                        upsert: true
                    }
                });
            }
        }

        if (queries.length > 0) {
            await this._db.collection(Collections.RaidsWeaknessRotations).bulkWrite(queries);
        }
    }

    _rollRaidWeaknesses() {
        return {
            element: ElementalWeakness[random.intRange(0, ElementalWeakness.length - 1)],
            weapon: WeaponWeaknesses[random.intRange(0, WeaponWeaknesses.length - 1)]
        }
    }
}

module.exports = RaidManager;