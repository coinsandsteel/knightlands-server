'use strict';

const {
    Collections
} = require("../database");

const Raid = require("./raid");
const Events = require("./../knightlands-shared/events");
import Game from "./../game";
const ObjectId = require("mongodb").ObjectID;

class RaidManager {
    constructor(db, paymentProcessor) {
        this.SummonPaymentTag = "raid_summon";

        this._db = db;
        this._factors = {};
        this._paymentProcessor = paymentProcessor;
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
    }

    async _getNextDktFactor(raidTemplateId, stage) {
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

        factor.step++;
        // save 
        await this._db.collection(Collections.RaidsDktFactors).updateOne({
            raid: raidTemplateId,
            stage: stage
        }, { $set: factor }, {
                upsert: true
            });

        return factorValue;
    }

    async summonRaid(summoner, stage, raidTemplateId) {
        let raitTemplate = await this._loadRaidTemplate(raidTemplateId);

        if (!raitTemplate) {
            throw "invalid raid";
        }

        stage = stage * 1;

        if (raitTemplate.stages.length <= stage) {
            throw "invalid raid";
        }

        // check if there is enough crafting materials
        let raidStage = raitTemplate.stages[stage];

        let summonRecipe = await this._loadSummonRecipe(raidStage.summonRecipe);
        if (!summoner.inventory.hasEnoughIngridients(summonRecipe.ingridients)) {
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
        let status = await this._paymentProcessor.fetchPaymentStatus(userId, this.SummonPaymentTag, {
            "context.raidTemplateId": raidTemplateId,
            "context.stage": stage
        });

        if (status) {
            // include current dkt factor
            status.dktFactor = await this._getNextDktFactor(raidTemplateId, stage);
        }

        return status;
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
            }
        ]).toArray();

        if (raid.length == 0) {
            throw "no such raid";
        }

        return raid[0];
    }

    async getCurrentRaids(userId) {
        let lootQuery = {};
        lootQuery[`loot.${userId}`] = false;

        let matchQuery = {
            $match: {
                $or: [
                    lootQuery,
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
                iapExecutor.registerAction(stage.iap, async (context) => {
                    return await this._summonRaid(context.summoner, context.stage, context.raidTemplateId);
                });

                iapExecutor.mapIAPtoEvent(stage.iap, Events.RaidSummonStatus);
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
                finished: true
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
}

module.exports = RaidManager;