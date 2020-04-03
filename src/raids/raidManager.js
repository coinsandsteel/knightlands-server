'use strict';

const {
    Collections
} = require("../database");

const Raid = require("./raid");
const Events = require("./../knightlands-shared/events");
import Elements from "./../knightlands-shared/elements";
const EquipmentType = require("./../knightlands-shared/equipment_type");
import Game from "./../game";
import { ObjectId } from "mongodb";
import Errors from "./../knightlands-shared/errors";
import random from "../random";

const WeaknessRotationCycle = 86400000;
const ElementalWeakness = [Elements.Water, Elements.Earth, Elements.Light, Elements.Darkness];
const WeaponWeaknesses = [EquipmentType.Axe, EquipmentType.Sword, EquipmentType.Bow, EquipmentType.Wand, EquipmentType.Spear];

const DktFactorUpdateInterval = 21600000; // every 6 hours

class RaidManager {
    constructor(db, paymentProcessor) {
        this.SummonPaymentTag = "raid_summon";
        this.JoinPaymentTag = "raid_join";

        this._db = db;
        this._factors = {};
        this._paymentProcessor = paymentProcessor;

        this._paymentProcessor.on(this._paymentProcessor.PaymentFailed, this._handlePaymentFailed.bind(this));
        this._paymentProcessor.on(this._paymentProcessor.PaymentSent, this._handlePaymentSent.bind(this));
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

    _scheduleDktUpdate() {

    }

    async _getNextDktFactor(raidTemplateId, stage, peek = false) {
        let factor = await this._db.collection(Collections.RaidsDktFactors).findOne({
            raid: raidTemplateId,
            stage: stage
        });

        if (!factor) {
            factor = {
                step: 0
            }
        }

        let factorSettings = this._factorSettings[stage];
        let factorValue = 1 / (factorSettings.attemptFactor * factor.step + 1 * (Math.log2((factor.step + 1) / factorSettings.baseFactor) / Math.log2(factorSettings.base)) + 1) * factorSettings.multiplier;

        if (!peek) {
            factor.step++;
            // save 
            await this._db.collection(Collections.RaidsDktFactors).updateOne({
                raid: raidTemplateId,
                stage: stage
            }, { $set: factor }, {
                upsert: true
            });
        }


        return factorValue;
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
                raid.stageData.joinIap,
                this.JoinPaymentTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
    }

    async _joinRaid(userId, raidId) {
        let raid = this.getRaid(raidId);
        if (!raid) {
            throw Errors.InvalidRaid;
        }

        await raid.join(userId);
    }

    async summonRaid(summoner, stage, raidTemplateId) {
        raidTemplateId *= 1;

        let raitTemplate = await this._loadRaidTemplate(raidTemplateId);

        if (!raitTemplate) {
            throw Errors.InvalidRaid;
        }

        stage = stage * 1;

        if (raitTemplate.stages.length <= stage) {
            throw Errors.InvalidRaid;
        }

        // check if there is enough crafting materials
        let raidStage = raitTemplate.stages[stage];

        let summonRecipe = await this._loadSummonRecipe(raidStage.summonRecipe);
        if (!(await summoner.inventory.hasEnoughIngridients(summonRecipe.ingridients))) {
            throw "no essences";
        }

        let iapContext = {
            summoner: summoner.address,
            stage: stage,
            raidTemplateId: raidTemplateId
        };

        // check if payment request already created
        let hasPendingPayment = await this._paymentProcessor.hasPendingRequestByContext(summoner.address, iapContext, this.SummonPaymentTag);
        if (hasPendingPayment) {
            throw "summoning in process already";
        }

        try {
            return await this._paymentProcessor.requestPayment(summoner.address,
                raidStage.iap,
                this.SummonPaymentTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
    }

    async _summonRaid(summonerId, stage, raidTemplateId) {
        // consume crafting resources
        let raidTemplate = await this._loadRaidTemplate(raidTemplateId);

        let userInventory = await Game.loadInventory(summonerId);
        await userInventory.autoCommitChanges(async inventory => {
            let raidStage = raidTemplate.stages[stage];
            // consume crafting materials
            let craftingRecipe = await this._loadSummonRecipe(raidStage.summonRecipe);
            inventory.consumeItemsFromCraftingRecipe(craftingRecipe);
        });

        const raid = new Raid(this._db);
        let currentFactor = await this._getNextDktFactor(raidTemplateId, stage);
        await raid.create(summonerId, stage, raidTemplateId, currentFactor);
        this._addRaid(raid);

        return {
            raid: raid.id
        };
    }

    // build an array of raids in process of summoning
    async getSummonStatus(userId, raidTemplateId, stage) {
        raidTemplateId *= 1;

        let status = await this._paymentProcessor.fetchPaymentStatus(userId, this.SummonPaymentTag, {
            "context.raidTemplateId": raidTemplateId,
            "context.stage": stage
        });

        if (!status) {
            status = {};
        }

        status.dktFactor = await this._getNextDktFactor(raidTemplateId, stage, true);
        status.weakness = await this._db.collection(Collections.RaidsWeaknessRotations).findOne({ raid: raidTemplateId, stage });
        status.weakness.untilNextWeakness = Game.now % WeaknessRotationCycle;

        return status;
    }

    async getJoinStatus(userId, raidId) {
        let status = await this._paymentProcessor.fetchPaymentStatus(userId, this.JoinPaymentTag, {
            "context.raidId": raidId
        });

        return status;
    }

    async fetchRaidCurrentMeta(raidTemplateId, stage) {
        let weakness = await this._db.collection(Collections.RaidsWeaknessRotations).find({ raid: raidTemplateId, stage });
        weakness.untilNextWeakness = Game.now % WeaknessRotationCycle;
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
                    participants: 0,
                    _id: 0
                }
            },
            {
                "$lookup": {
                    "from": "raid_weakness_rotations",
                    "let": {
                        "raid": "$raidTemplateId",
                        "stage": "$stage"
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
                                        },
                                        {
                                            "$eq": [
                                                "$stage",
                                                "$$stage"
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
        info.weakness.untilNextWeakness = Game.now % WeaknessRotationCycle;
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

        let inclusiveProject = {
            $project: {
                raidTemplateId: 1,
                stage: 1,
                timeLeft: 1,
                busySlots: 1,
                bossState: 1,
                finished: 1,
                id: 1,
                _id: 0
            }
        };
        inclusiveProject.$project[participantId] = 1;

        return await this._db.collection(Collections.Raids).aggregate([
            matchQuery,
            {
                "$addFields": {
                    "id": { "$toString": "$_id" }
                }
            },
            inclusiveProject
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
            raid.stages.forEach(stage => {
                if (stage.iap) {
                    iapExecutor.registerAction(stage.iap, async (context) => {
                        return await this._summonRaid(context.summoner, context.stage, context.raidTemplateId);
                    });

                    iapExecutor.mapIAPtoEvent(stage.iap, Events.RaidSummonStatus);
                }

                if (stage.joinIap) {
                    iapExecutor.registerAction(stage.joinIap, async (context) => {
                        return await this._joinRaid(context.userId, context.raidId);
                    });

                    iapExecutor.mapIAPtoEvent(stage.joinIap, Events.RaidJoinStatus);
                }
            });

        });
    }

    getRaid(raidId) {
        return this._getRaid(raidId);
    }

    _getRaid(raidId) {
        return this._raids[raidId];
    }

    _addRaid(raid) {
        this._raids[raid.id] = raid;

        raid.on(raid.TimeRanOut, this._handleRaidTimeout.bind(this));
        raid.on(raid.Defeat, this._handleRaidDefeat.bind(this));
    }

    async _handleRaidTimeout(raid) {
        await raid.finish();
        this._removeRaid(raid.id);
    }

    async _handleRaidDefeat(raid) {
        await raid.finish();
        this._removeRaid(raid.id);
    }

    _removeRaid(id) {
        delete this._raids[id];
    }

    async claimLoot(user, raidId) {
        let userId = user.address;

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
            throw "no such raid";
        }

        raidData = raidData[0];

        let raid = new Raid(this._db);
        await raid.init(raidData);

        return await raid.claimLoot(userId);
    }

    _scheduleWeaknessUpdate() {
        setTimeout(async () => {
            try {
                await this._updateWeaknesses();
            } finally {
                this._scheduleWeaknessUpdate();
            }
        }, Game.now % WeaknessRotationCycle);
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
                let stages = weaknessLookup[weakness.raid];
                if (!stages) {
                    stages = {};
                    weaknessLookup[weakness.raid] = stages;
                }
                stages[weakness.stage] = weakness;
            }
        }

        let queries = [];
        const length = allRaids.length;
        for (let i = 0; i < length; i++) {
            const raidTemplate = allRaids[i];
            for (let j = 0; j < raidTemplate.stages.length; j++) {
                let missing = false;
                let stages = weaknessLookup[raidTemplate._id];
                if (!stages) {
                    stages = {};
                    weaknessLookup[raidTemplate._id] = stages;
                }

                let weakness = stages[j];
                if (weakness) {
                    weakness.current = weakness.next;
                    weakness.next = this._rollRaidWeaknesses();
                } else {
                    weakness = {
                        current: this._rollRaidWeaknesses(),
                        next: this._rollRaidWeaknesses(),
                        raid: raidTemplate._id,
                        stage: j
                    };
                    stages[j] = weakness;
                    missing = true;
                }

                if ((onlyMissing && missing) || !onlyMissing) {
                    queries.push({
                        updateOne: {
                            filter: {
                                raid: weakness.raid,
                                stage: weakness.stage
                            },
                            update: {
                                $set: weakness
                            },
                            upsert: true
                        }
                    });
                }
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