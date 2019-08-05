'use strict';

const {
    Collections
} = require("../database");

const Raid = require("./raid");
const inventory = require("./../inventory");
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
            let raid = raids[i];
            let template = await this._loadRaidTemplate(raid.raidTemplateId);
            this._raids[raid._id.valueOf()] = new Raid(this._db, raid, template);
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
        let raidEntry = {
            summoner: summonerId,
            stage,
            raidTemplateId,
            participants: {
                summoner: true
            },
            challenges: {}
        };

        let raidTemplate = await this._loadRaidTemplate(raidTemplateId);

        // load player inventory. If player online - use loaded inventory. Or load inventory directly;
        let userInventory;
        let playerOnline = Game.getPlayerController(summonerId);
        if (playerOnline) {
            userInventory = (await playerOnline.getUser()).inventory;
        } else {
            userInventory = new inventory(summonerId, this._db);
        }

        await userInventory.loadAllItems();

        let raidStage = raidTemplate.stages[stage];
        // consume crafting materials
        let craftingRecipe = await this._loadSummonRecipe(raidStage.summonRecipe);
        userInventory.consumeItemsFromCraftingRecipe(craftingRecipe);

        {
            const length = raidStage.challenges.length;
            let i = 0;
            for (; i < length; ++i) {
                let challenge = raidStage.challenges[i];
                raidEntry.challenges[challenge.type] = {}; // can't have 2 same challenges. Stores state for challenge instance
            }
        }

        raidEntry.timeLeft = Math.floor(new Date().getTime() / 1000 + raidStage.duration);

        let bossState = {};
        // bossState[CharacterStats.Health] = raidStage.health;
        // bossState[CharacterStats.Attack] = raidStage.attack;
        raidEntry.bossState = bossState;

        let insertResult = await this._db.collection(Collections.Raids).insertOne(raidEntry);
        raidEntry._id = insertResult.insertedId;

        const raidIdStr = raidEntry._id.valueOf();
        this._raids[raidIdStr] = new Raid(this._db, raidEntry, raidStage);

        return {
            raid: raidIdStr
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