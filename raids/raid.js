'use strict';

const {
    Collections
} = require("../database");

const Unit = require("./../combat/unit");

import CharacterStats from "./../knightlands-shared/character_stat";

const ObjectId = require("mongodb").ObjectID;

class Raid {
    constructor(db) {
        this._db = db;
    }

    get stage() {
        return this._data.stage;
    }

    get id() {
        return this._data._id.valueOf();
    }

    get finished() {
        return this._bossUnit.isAlive;
    }

    async create(summonerId, stage, raidTemplateId) {
        let raidEntry = {
            summoner: summonerId,
            stage,
            raidTemplateId,
            participants: {
                summoner: true
            },
            challenges: {},
            looted: false
        };

        let raidTemplate = await this._loadRaidTemplate(raidTemplateId);
        let raidStage = raidTemplate.stages[stage];

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
        bossState[CharacterStats.Health] = raidStage.health;
        bossState[CharacterStats.Attack] = raidStage.attack;
        raidEntry.bossState = bossState;

        let insertResult = await this._db.collection(Collections.Raids).insertOne(raidEntry);
        raidEntry._id = insertResult.insertedId;
        await this._initFromData(raidEntry);
    }

    async init(data) {
        await this._initFromData(data);
    }

    async _initFromData(data) {
        this._template = await this._loadRaidTemplate(data.raidTemplateId);

        this._data = data;

        let maxStats = {};
        maxStats[CharacterStats.Health] = this._template.health;
        maxStats[CharacterStats.Attack] = this._template.attack;

        this._bossUnit = new Unit(this._data.bossState, maxStats);
    }

    async _loadRaidTemplate(raidTemplateId) {
        return await this._db.collection(Collections.RaidsMeta).findOne({
            _id: raidTemplateId * 1
        });
    }

    join(user) {

    }

    attack(attacker) {
        if (this._data.participants[attacker.id]) {
            throw "not part of the raid";
        }


    }
}

module.exports = Raid;