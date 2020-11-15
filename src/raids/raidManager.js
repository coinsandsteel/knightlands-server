'use strict';

const {
    Collections
} = require("../database");

const Raid = require("./raid");
const Events = require("../knightlands-shared/events");
import Elements from "../knightlands-shared/elements";
const EquipmentType = require("../knightlands-shared/equipment_type");
import Game from "../game";
import { ObjectId } from "mongodb";
import Errors from "../knightlands-shared/errors";
import random from "../random";
import { TokenRateTimeseries } from "./tokenRateTimeseries";

const WeaknessRotationCycle = 86400000 * 7;
const ElementalWeakness = [Elements.Water, Elements.Earth, Elements.Light, Elements.Darkness];
const WeaponWeaknesses = [EquipmentType.Axe, EquipmentType.Sword, EquipmentType.Bow, EquipmentType.Wand, EquipmentType.Spear];

const DktFactorUpdateInterval = 1800000; // every 30 minutes
// const DktFactorUpdateInterval = 10000; // every 10 seconds
const DKT_RESTORE_FACTOR = 0.05;

const FINISHED_RAID_CACHE_TTL = 3600000; // 1 hour

class RaidManager {
    constructor(db, paymentProcessor) {
        this.SummonPaymentTag = "raid_summon";
        this.JoinPaymentTag = "raid_join";

        this._db = db;
        this._factors = {};
        this._paymentProcessor = paymentProcessor;

        this._paymentProcessor.on(this._paymentProcessor.PaymentFailed, this._handlePaymentFailed.bind(this));
        this._paymentProcessor.on(this._paymentProcessor.PaymentSent, this._handlePaymentSent.bind(this));

        this.tokenRates = new TokenRateTimeseries(db);
    }

    async init(iapExecutor) {
        let settings = await this._db.collection(Collections.RaidsDktMeta).find({}).toArray();

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

        await this._registerRaidIAPs(iapExecutor);

        await this._updateWeaknesses(true);
        await this._restoreDktForAllRaids(true);
        this._scheduleWeaknessUpdate();
        this._scheduleDktUpdate();
    }

    async _handlePaymentFailed(tag, context) {
        if (tag == this.JoinPaymentTag) {
            // payment failed, free slot
            let raid = this.getRaid(context.raidId);
            await raid.setReserveSlot(false);
        }
    }

    async _handlePaymentSent(tag, context) {
        if (tag == this.JoinPaymentTag) {
            // payment sent, reserve slot
            let raid = this.getRaid(context.raidId);
            await raid.setReserveSlot(true);
        }
    }

    async joinRaid(userId, raidId) {
        let raid = this.getRaid(raidId);
        if (!raid) {
            throw Errors.InvalidRaid;
        }

        if (raid.isFull) {
            throw Errors.RaidIsFull;
        }

        let iapContext = {
            userId,
            raidId
        };

        // check if payment request already created
        let hasPendingPayment = await this._paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.JoinPaymentTag);
        if (hasPendingPayment) {
            throw "summoning in process already";
        }

        try {
            return await this._paymentProcessor.requestPayment(
                userId,
                raid.template.joinIap,
                this.JoinPaymentTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
    }

    async joinFreeRaid(userId, raidId) {
        return await this.summonRaid(userId, raidId, true)
    }

    async _joinRaid(userId, raidId) {
        let raid = this.getRaid(raidId);
        if (!raid) {
            throw Errors.InvalidRaid;
        }

        const user = await Game.getUser(userId);
        await user.dailyQuests.onPaidRaidJoin();
        await raid.join(userId);
    }

    async summonRaid(summoner, raidTemplateId, free) {
        raidTemplateId *= 1;

        let raitTemplate = await this._loadRaidTemplate(raidTemplateId);

        if (!raitTemplate) {
            throw Errors.InvalidRaid;
        }

        // check if there is enough crafting materials
        let data = free ? raitTemplate.soloData : raitTemplate.data;
        let summonRecipe = await this._loadSummonRecipe(data.summonRecipe);

        if (!(await summoner.inventory.hasEnoughIngridients(summonRecipe.ingridients))) {
            throw "no essences";
        }

        if (!free) {
            let iapContext = {
                summoner: summoner.address,
                raidTemplateId: raidTemplateId
            };

            // check if payment request already created
            let hasPendingPayment = await this._paymentProcessor.hasPendingRequestByContext(summoner.address, iapContext, this.SummonPaymentTag);
            if (hasPendingPayment) {
                throw "summoning in process already";
            }

            try {
                return await this._paymentProcessor.requestPayment(summoner.address,
                    data.iap,
                    this.SummonPaymentTag,
                    iapContext
                );
            } catch (exc) {
                throw exc;
            }
        } else {
            return await this._summonRaid(summoner.address, raidTemplateId, true);
        }
    }

    async _summonRaid(summonerId, raidTemplateId, isFree) {
        // consume crafting resources
        let raidTemplate = await this._loadRaidTemplate(raidTemplateId);
        const data = isFree ? raidTemplate.soloData : raidTemplate.data;

        let userInventory = await Game.loadInventory(summonerId);
        await userInventory.autoCommitChanges(async inventory => {
            // consume crafting materials
            let craftingRecipe = await this._loadSummonRecipe(data.summonRecipe);
            await inventory.consumeItemsFromCraftingRecipe(craftingRecipe);
        });

        const raid = new Raid(this._db);
        await raid.create(summonerId, raidTemplateId, isFree);
        this._addRaid(raid);

        if (!isFree) {
            const user = await Game.getUser(summonerId);
            await user.dailyQuests.onPaidRaidJoin();
        }

        return {
            raid: raid.id
        };
    }

    // build an array of raids in process of summoning
    async getSummonStatus(userId, raidTemplateId) {
        raidTemplateId *= 1;

        let status = await this._paymentProcessor.fetchPaymentStatus(userId, this.SummonPaymentTag, {
            "context.raidTemplateId": raidTemplateId
        });

        if (!status) {
            status = {};
        }

        status.dktFactor = await this._getNextDktFactor(raidTemplateId, true);
        status.weakness = await this._db.collection(Collections.RaidsWeaknessRotations).findOne({ raid: raidTemplateId });
        status.weakness.untilNextWeakness = WeaknessRotationCycle - Game.now % WeaknessRotationCycle;

        return status;
    }

    async getJoinStatus(userId, raidId) {
        let status = await this._paymentProcessor.fetchPaymentStatus(userId, this.JoinPaymentTag, {
            "context.raidId": raidId
        });

        return status;
    }

    async fetchRaidCurrentMeta(raidTemplateId) {
        let weakness = await this._db.collection(Collections.RaidsWeaknessRotations).find({ raid: raidTemplateId });
        weakness.untilNextWeakness = WeaknessRotationCycle - Game.now % WeaknessRotationCycle;
        return weakness;
    }

    async getRaidInfo(userId, raidId) {
        let raid = await this._db.collection(Collections.Raids).aggregate([
            {
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
            },
            {
                "$lookup": {
                    "from": "raid_weakness_rotations",
                    "let": {
                        "raid": "$raidTemplateId"
                    },
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {
                                            "$eq": [
                                                "$raid",
                                                "$$raid"
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "weakness"
                }
            },
            {
                "$addFields": {
                    "weakness": {
                        "$arrayElemAt": [
                            "$weakness",
                            0
                        ]
                    }
                }
            }
        ]).toArray();

        if (raid.length == 0) {
            throw "no such raid";
        }

        let info = raid[0];

        if (info.isFree) {
            const firstClearance = await this._db.collection(Collections.FreeRaidsClearance).findOne(
                { raidId: raidId, user: userId }
            );
            info.isFirst = !!firstClearance;
        }

        info.weakness.untilNextWeakness = WeaknessRotationCycle - Game.now % WeaknessRotationCycle;
        info.dktFactor = await this._getNextDktFactor(info.raidTemplateId, true);
        return info;
    }

    async getCurrentRaids(userId) {
        let lootQuery = {};
        lootQuery[`loot.${userId}`] = false;

        let matchQuery = {
            $match: {
                $or: [
                    {
                        $and: [lootQuery, { defeat: true }]
                    },
                    {
                        finished: false
                    }
                ]
            }
        };

        let participantId = `participants.${userId}`;
        matchQuery.$match[participantId] = { $exists: true };

        return await this._db.collection(Collections.Raids).aggregate([
            matchQuery,
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
                    [participantId]: 1
                }
            }
        ]).toArray();
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

    async _registerRaidIAPs(iapExecutor) {
        console.log("Registering Raid IAPs...");

        let allRaids = await this._db.collection(Collections.RaidsMeta).find({}).toArray();
        allRaids.forEach(raid => {
            if (raid.data.iap) {
                iapExecutor.registerAction(raid.data.iap, async (context) => {
                    return await this._summonRaid(context.summoner, context.raidTemplateId, false);
                });

                iapExecutor.mapIAPtoEvent(raid.data.iap, Events.RaidSummonStatus);
            }

            if (raid.data.joinIap) {
                iapExecutor.registerAction(raid.data.joinIap, async (context) => {
                    return await this._joinRaid(context.userId, context.raidId);
                });

                iapExecutor.mapIAPtoEvent(raid.data.joinIap, Events.RaidJoinStatus);
            }
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
            const user = await Game.getUser(summonerId);
            await user.dailyQuests.onFreeRaidFinished();
        } else {
            dktFactor = await this._getNextDktFactor(raid.templateId)
        }

        await raid.finish(dktFactor);
        this._removeRaid(raid.id);
    }

    _removeRaid(id) {
        delete this._raids[id];
    }

    async claimLoot(user, raidId) {
        let userId = user.address;
        let raid = await this._getFinishedRaid(userId, raidId);
        return await raid.claimLoot(userId);
    }

    async getLootPreview(user, raidId) {
        let userId = user.address;
        let raid = await this._getFinishedRaid(userId, raidId);
        return await raid.getRewards(userId);
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
            matchQuery.$match[lootId] = false;

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

    _scheduleDktUpdate() {
        setTimeout(async () => {
            try {
                await this._restoreDktForAllRaids();
            } finally {
                this._scheduleDktUpdate();
            }
        }, DktFactorUpdateInterval - Game.now % DktFactorUpdateInterval);
    }

    _getDktFactor(step) {
        step = step || 1;
        let factorSettings = this._factorSettings[0];
        const scaledStep = factorSettings.attemptFactor * step;
        const log = Math.log2(step / factorSettings.baseFactor) / Math.log2(factorSettings.base);
        return 1 / (scaledStep * log + 1) * factorSettings.multiplier * Game.dividends.getDivTokenRate();
    }

    async _getNextDktFactor(raidTemplateId, peek = false) {
        let factor = await this._db.collection(Collections.RaidsDktFactors).findOne({
            raid: raidTemplateId
        });

        if (!factor) {
            factor = {
                step: 0
            }
        }

        // TODO settings per difficulty
        const factorValue = this._getDktFactor(factor.step);

        if (!peek) {
            factor.step++;
            // save 
            await this._db.collection(Collections.RaidsDktFactors).updateOne({
                raid: raidTemplateId
            }, { $set: factor }, {
                upsert: true
            });

            this.tokenRates.updateRate(raidTemplateId, factorValue);
        }

        return factorValue ;
    }

    async _restoreDktForAllRaids(onlyMissing = false) {
        let allRaids = await this._db.collection(Collections.RaidsMeta).find({}).toArray();

        const templates = [];
        for (const raidTemplate of allRaids) {
            templates.push(raidTemplate._id);
        }

        let factors = await this._db.collection(Collections.RaidsDktFactors).find({
            raid: { $in: templates }
        }).toArray();

        const factorsLookup = {};

        for (const factor of factors) {
            factorsLookup[factor.raid] = factor;
        }

        const queries = [];
        const rateQueries = [];
        const now = Game.now;
        // every 30 minutes restore 5%
        for (const raidId of templates) {
            let missing = false;
            if (!factorsLookup[raidId]) {
                missing = true;
                factorsLookup[raidId] = {
                    step: 1
                }
            }

            factorsLookup[raidId].step -= Math.ceil(factorsLookup[raidId].step * DKT_RESTORE_FACTOR);

            if ((onlyMissing && missing) || !onlyMissing) {
                queries.push({
                    updateOne: {
                        filter: {
                            raid: raidId
                        },
                        update: {
                            $set: factorsLookup[raidId]
                        },
                        upsert: true
                    }
                });

                rateQueries.push({
                    insertOne: {
                        raidTemplateId: raidId,
                        r: this._getDktFactor(factorsLookup[raidId].step),
                        t: now
                    }
                });
            }
        }

        if (rateQueries.length > 0) {
            await this.tokenRates.insertRates(rateQueries);
        }
        
        if (queries.length > 0) {
            await this._db.collection(Collections.RaidsDktFactors).bulkWrite(queries);
        }
    }

    _scheduleWeaknessUpdate() {
        setTimeout(async () => {
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

        const weaknessLookup = {};
        {
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
