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

const WeaknessRotationCycle = 86400000 * 7;
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

    async _getNextDktFactor(raidTemplateId, peek = false) {
        // let factor = await this._db.collection(Collections.RaidsDktFactors).findOne({
        //     raid: raidTemplateId
        // });

        // if (!factor) {
        //     factor = {
        //         step: 0
        //     }
        // }

        // let factorSettings = this._factorSettings[stage];
        // let factorValue = 1 / (factorSettings.attemptFactor * factor.step + 1 * (Math.log2((factor.step + 1) / factorSettings.baseFactor) / Math.log2(factorSettings.base)) + 1) * factorSettings.multiplier;

        // if (!peek) {
        //     factor.step++;
        //     // save 
        //     await this._db.collection(Collections.RaidsDktFactors).updateOne({
        //         raid: raidTemplateId
        //     }, { $set: factor }, {
        //         upsert: true
        //     });
        // }


        return 1;
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

    async _joinRaid(userId, raidId) {
        let raid = this.getRaid(raidId);
        if (!raid) {
            throw Errors.InvalidRaid;
        }

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
            inventory.consumeItemsFromCraftingRecipe(craftingRecipe);
        });

        const raid = new Raid(this._db);
        let currentFactor = await this._getNextDktFactor(raidTemplateId);
        await raid.create(summonerId, raidTemplateId, currentFactor, isFree);
        this._addRaid(raid);

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
        status.weakness.untilNextWeakness = Game.now % WeaknessRotationCycle;

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
