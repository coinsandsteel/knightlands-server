'use strict';

const {
    Collections
} = require("../database");

const Raid = require("./raid");
const Events = require("./../knightlands-shared/events");
import Game from "./../game";

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
        let raids = await this._db.collection(Collections.Raids).find({}).toArray();

        this._raids = {};

        let i = 0;
        const length = raids.length;
        for (; i < length; i++) {
            let raidData = raids[i];
            let raid = new Raid(this._db);
            await raid.init(raidData);
            this._raids[raid.id] = raid;
        }

        await this._registerRaidIAPs(iapExecutor);
    }

    async _getCurrentFactor(raidTemplateId, stage) {
        let factor = await this._db.collection(Collections.RaidsDktFactors).findOne({
            raid: raidTemplateId,
            stage
        });

        if (!factor) {
            factor = {
                step: 0
            }
        }

        return factor;
    }

    async getCurrentFactor(raidTemplateId, stage) {
        let factor = this._getCurrentFactor(raidTemplateId, stage);
        let factorSettings = this._factorSettings[stage];
        return 1 / (factorSettings.attemptFactor * factor.step + 1 * (Math.log2((factor.step + 1) / factorSettings.baseFactor) / Math.log2(factorSettings.base)) + 1) * factor.factor;
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
        await raid.create(summonerId, stage, raidTemplateId);
        this._raids[raid.id] = raid;

        return {
            raid: raid.id
        };
    }

    // build an array of raids in process of summoning
    async getSummonStatus(userId, raidTemplateId, stage) {
        return await this._paymentProcessor.fetchPaymentStatus(userId, this.SummonPaymentTag, {
            "context.raidTemplateId": raidTemplateId,
            "context.stage": stage
        });
    }

    async getRaidInfo(raidId) {
        if (!this._raids[raidId]) {
            throw "no such raid";
        }

        let raid = this._raids[raidId];
        let currentFactor = await this.getCurrentFactor(raid.id, raid.stage);
        return raid.getInfo(currentFactor);
    }

    async getUnfinishedRaids(userId) {
        return await this._db.collection(Collections.Raids).aggregate([
            {
                $match: {
                    summoner: userId,
                    looted: false
                },
            },
            {
                "$addFields": {
                    "id": { "$toString": "$_id" }
                }
            },
            {
                $project: {
                    _id: 0
                }
            }
        ]).toArray();
    }

    async onRaidFinished(raidId, success) {
        if (!success) {
            return;
        }

        let raid = this._raids[raidId];

        let currentFactor = await this._getCurrentFactor(raid.id, raid.stage);
        // increase step
        currentFactor.step++;
        // save 
        await this._db.collection(Collections.RaidsDktFactors).replaceOne({
            raid: raid.id,
            stage: raid.stage
        }, currentFactor, {
                upsert: true
            });
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

        let allRaids = await this._db.collection(Collections.RaidsMeta).find({});
        allRaids.forEach(raid => {
            raid.stages.forEach(stage => {
                iapExecutor.registerAction(stage.iap, async (context) => {
                    return await this._summonRaid(context.summoner, context.stage, context.raidTemplateId);
                });

                iapExecutor.mapIAPtoEvent(stage.iap, Events.RaidSummonStatus);
            });

        });
    }
}

module.exports = RaidManager;