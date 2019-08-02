'use strict';

const {
    Collections
} = require("../database");

const Raid = require("./raid");

class RaidManager {
    constructor(db) {
        this._db = db;
        this._factors = {};
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

    async createPaymentRequest(user, stage, raidTemplateId) {
        let raitTemplate = await this._loadRaidTemplate(raidTemplateId);
        return [
            user.address,
            raitTemplate.stages[stage].iap,
            {
                summoner: user.address,
                stage: stage,
                raidTemplateId: raidTemplateId
            }
        ];
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

    async canSummon(summoner, stage, raidTemplateId) {
        let template = await this._loadRaidTemplate(raidTemplateId);

        // check if there is enough crafting materials
        stage = stage * 1;

        if (template.stages.length <= stage) {
            return false;
        }

        let raidStage = template.stages[stage];

        let summonRecipe = await this._loadSummonRecipe(raidStage.summonRecipe);

        if (!summoner.inventory.hasEnoughIngridients(summonRecipe.ingridients)) {
            return false;
        }

        return true;
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

        {
            const length = template.challenges.length;
            let i = 0;
            for (; i < length; ++i) {
                let challenge = template.challenges[i];
                raidEntry.challenges[challenge.type] = {}; // can't have 2 same challenges. Stores state for challenge instance
            }
        }

        raidEntry.timeLeft = new Date().getTime() / 1000 + template.duration;

        let bossState = {};
        bossState[CharacterStats.Health] = template.health;
        bossState[CharacterStats.Attack] = template.attack;
        raidEntry.bossState = bossState;

        let insertResult = await this._db.collection(Collections.Raids).insertOne(raidEntry);
        raidEntry._id = insertResult.insertedId;

        this._raids[raidEntry._id.valueOf()] = new Raid(this._db, raidEntry, template);
    }

    async getSummoningList(userId) {

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
                    this._summonRaid(...context);
                });
            });

        });
    }
}

module.exports = RaidManager;