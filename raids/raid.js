'use strict';

const {
    Collections
} = require("../database");

const Unit = require("./../combat/unit");

import CharacterStats from "./../knightlands-shared/character_stat";

const ObjectId = require("mongodb").ObjectID;

class Raid {
    constructor(db, data, template) {
        this._db = db;
        this._data = data;
        this._template = template;
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

    async init(raidId) {
        let data = await this._db.collection(Collections.Raids).findOne({
            _id: new ObjectId(raidId)
        });

        if (!data) {
            return false;
        }

        await this._loadRaidTemplate();

        this._initFromData(data);

        return true;
    }

    _initFromData(data) {
        this._data = data;

        let maxStats = {};
        maxStats[CharacterStats.Health] = this._template.health;
        maxStats[CharacterStats.Attack] = this._template.attack;

        this._bossUnit = new Unit(this._data.bossState, maxStats);
    }

    join(user) {

    }

    attack(attacker) {
        if (this._data.participants[attacker.id]) {
            throw "not part of the raid";
        }


    }

    getInfo(currentDktFactor) {
        let info = {

        };


    }
}

module.exports = Raid;