'use strict';

const {
    Collections
} = require("../database");

const CBuffer = require("./../CBuffer");
const Unit = require("./../combat/unit");
import CharacterStats from "./../knightlands-shared/character_stat";
import Game from "../game";
const EventEmitter = require("events");
const ObjectId = require("mongodb").ObjectID;
const Events = require("./../knightlands-shared/events");
const Config = require("./../config");
const Random = require("./../random");
import Errors from "./../knightlands-shared/errors";

import RaidChallengeType from "./../knightlands-shared/raid_challenge";
const TopDamageDealers = require("./topDamageDealersChallenge");

const HitsDamage = {
    1: 1,
    5: 1.01,
    10: 1.025,
    20: 1.07,
    50: 1.2
}

class Raid extends EventEmitter {
    constructor(db) {
        super();

        this.Hit = "hit";
        this.BossKilled = "boss-killed";

        this.TimeRanOut = "time_ran_out";
        this.Defeat = "defeat";

        this._db = db;

        this._damageLog = new CBuffer(15);
        this._challenges = [];
    }

    get stage() {
        return this._data.stage;
    }

    get id() {
        return this._data._id.valueOf();
    }

    get finished() {
        return !this._bossUnit.isAlive || this._data.timeLeft < 1;
    }

    get stageData() {
        return this._template.stages[this._data.stage];
    }

    get defeat() {
        return !this._bossUnit.isAlive;
    }

    async create(summonerId, stage, raidTemplateId, dktFactor) {
        let raidEntry = {
            summoner: summonerId,
            stage,
            raidTemplateId,
            participants: {},
            challenges: {},
            finished: false,
            dktFactor,
            loot: {},
            damageLog: []
        };

        raidEntry.participants[summonerId] = 0;

        let raidTemplate = await this._loadRaidTemplate(raidTemplateId);
        let raidStage = raidTemplate.stages[stage];

        raidEntry.creationTime = new Date().getTime() / 1000;
        raidEntry.duration = raidStage.duration;
        raidEntry.timeLeft = Math.floor(raidEntry.duration - (Game.now / 1000 - raidEntry.creationTime));
        raidEntry.busySlots = 1; // summoner

        let bossState = {};
        bossState[CharacterStats.Health] = raidStage.health;
        bossState[CharacterStats.Attack] = raidStage.attack;
        raidEntry.bossState = bossState;

        let insertResult = await this._db.collection(Collections.Raids).insertOne(raidEntry);
        raidEntry._id = insertResult.insertedId;
        await this._initFromData(raidEntry);
    }

    get channelName() {
        return `raid/${this.id}`;
    }

    async init(data) {
        await this._initFromData(data);
    }

    getInfo() {
        let info = { ...this._data };
        info.id = this.id;
        delete info._id;
        return info;
    }

    isParticipant(userId) {
        return this._data.participants[userId] !== undefined;
    }

    async _initFromData(data) {
        this._template = await this._loadRaidTemplate(data.raidTemplateId);

        this._data = data;

        {
            // randomly chose up to challengeCount challenges
            let challengesToChoose = this.stageData.challengeCount;
            let challengesMeta = this.stageData.challenges;
            let i = 0;
            const length = challengesMeta.length;
            let indicies = [];
            for (; i < length; ++i) {
                indicies.push(i);
            }

            while (indicies.length > 0 && challengesToChoose > 0) {
                challengesToChoose--;

                // roll next random index and remove it by swapping with tail
                let challengeIndex = Random.intRange(0, indicies.length - 1);
                indicies[challengeIndex] = indicies[indicies.length - 1];
                indicies.pop();

                let meta = challengesMeta[challengeIndex];
                let challengeData = data.challenges[meta.type];
                this._challenges.push(this._createChallenge(meta.type, meta, challengeData));
            }
        }

        {
            let i = 0;
            const length = data.damageLog.length;
            for (; i < length; ++i) {
                this._damageLog.push(data.damageLog[i]);
            }
        }

        let maxStats = {};
        maxStats[CharacterStats.Health] = this._template.health;
        maxStats[CharacterStats.Attack] = this._template.attack;

        this._bossUnit = new Unit(this._data.bossState, maxStats);

        this._timerInterval = setInterval(this._updateTimeLeft.bind(this), 1000);
        this._scheduleCheckpoint();
    }

    _updateTimeLeft() {
        this._data.timeLeft--;
        if (this._data.timeLeft <= 0) {
            Game.publishToChannel(this.channelName, { event: Events.RaidFinished, defeat: false });

            this.emit(this.TimeRanOut, this);
        }
    }

    async finish() {
        clearTimeout(this._checkpointTimeout);
        clearInterval(this._timerInterval);

        await this._checkpoint();
    }

    async _loadRaidTemplate(raidTemplateId) {
        return await this._db.collection(Collections.RaidsMeta).findOne({
            _id: raidTemplateId * 1
        });
    }

    async join(user) {
        if (this._data.busySlots >= this.stageData.maxSlots) {
            throw "no free slot";
        }

        this._data.participants[user.address] = 0;
        this._data.busySlots++;

        await this._db.collection(Collections.Raids).updateOne({ _id: this.id }, {
            $set: {
                busySlots: this._data.busySlots,
                participants: this._data.participants
            }
        });
    }

    async attack(attacker, hits) {
        if (!this.isParticipant(attacker.address)) {
            throw "not part of the raid";
        }

        if (HitsDamage[hits] === undefined) {
            throw "incorrect hits";
        }

        let combatUnit = attacker.getCombatUnit();
        if (!combatUnit.isAlive) {
            throw Errors.NoHealth;
        }

        // check if player has enough stamina for requested hits
        let staminaRequired = hits;
        if (attacker.getTimerValue(CharacterStats.Stamina) < staminaRequired) {
            throw Errors.NoStamina;
        }

        attacker.modifyTimerValue(CharacterStats.Stamina, -staminaRequired);

        let bonusDamage = HitsDamage[hits];
        let totalDamageInflicted = 0;
        let hitsToPerform = hits;
        while (hitsToPerform > 0) {
            hitsToPerform--;
            // boss attacks first to avoid abusing 1 hp tactics
            this._bossUnit.attack(combatUnit);

            if (combatUnit.isAlive) {
                let damageDone = combatUnit.attackRaid(this._bossUnit, bonusDamage);
                totalDamageInflicted += damageDone;
                this._data.participants[attacker.address] += damageDone;

                // set loot flag in here to avoid sharp spike after raid is finished
                if (this._data.loot[attacker.address] === undefined) {
                    // check if at least first loot damage threshold is reached and set loot record
                    let loot = this.stageData.loot;
                    if (loot.length > 0) {
                        if (loot[0].damageThreshold <= this._data.participants[attacker.address]) {
                            this._data.loot[attacker.address] = false;
                        }
                    }
                }

                // notify current challenges
                this.emit(this.Hit, attacker, damageDone);

                if (!this._bossUnit.isAlive) {
                    this.emit(this.BossKilled, attacker, damageDone, this._data.timeLeft);

                    // emit victory and let know to raid manager
                    this._publishEvent({ event: Events.RaidFinished, defeat: true });
                    this.emit(this.Defeat, this);
                }
            }
        }

        if (totalDamageInflicted > 0) {
            let damageLog = {
                by: attacker.address,
                damage: totalDamageInflicted,
                hits: hits - hitsToPerform
            };
            this._damageLog.push(damageLog);

            this._publishEvent({ event: Events.RaidDamaged, bossHp: this._bossUnit.getHealth(), ...damageLog });

            // finalize challenges to detect final changes inside 
            {
                let i = 0;
                const length = this._challenges.length;

                for (; i < length; ++i) {
                    this._challenges[i].finalize();
                }
            }
        }
    }

    async _checkpoint() {
        {
            let i = 0;
            const length = this._challenges.length;

            for (; i < length; ++i) {
                let challenge = this._challenges[i];
                this._data.challenges[challenge.type()] = challenge.snapshot();
                this._publishEvent({ event: Events.RaidChallengeUpdate, type: challenge.type(), data: challenge.snapshot() });
            }
        }

        await this._db.collection(Collections.Raids).updateOne({ _id: this.id }, {
            $set: {
                timeLeft: this._data.timeLeft,
                bossState: this._data.bossState,
                participants: this._data.participants,
                finished: this.finished,
                damageLog: this._damageLog.toArray(),
                defeat: this.defeat,
                loot: this._data.loot,
                challenges: this._data.challenges
            }
        });

        this._scheduleCheckpoint();
    }

    async claimLoot(userId) {
        // determine raid loot record based on user damage
        let chosenLoot;
        let raidStage = this.stageData;
        let userDamage = this._data.participants[userId];
        {
            let i = 0;
            const length = raidStage.loot.length;
            for (; i < length; ++i) {
                if (userDamage >= raidStage.loot[i].damageThreshold) {
                    chosenLoot = raidStage.loot[i];
                } else {
                    break;
                }
            }
        }

        if (!chosenLoot) {
            return null
        }

        let rewards = {
            dkt: chosenLoot.dktReward * Random.range(raidStage.minDkt, raidStage.maxDkt),
            exp: raidStage.exp,
            gold: raidStage.gold,
            hardCurrency: 0
        };

        rewards.items = await Game.lootGenerator.getRaidLoot(chosenLoot);

        // evaluate challenges
        {
            let i = 0;
            const length = this._challenges.length;

            for (; i < length; ++i) {
                let challenge = this._challenges[i];
                let challengeRewards = challenge.getRewards(userId);

                if (challengeRewards.loot) {
                    let challengeItems = await Game.lootGenerator.getLootFromTable(challengeRewards.loot, challengeRewards.rolls);
                    if (challengeItems) {
                        rewards.items = rewards.items.concat(challengeItems);
                    }
                }

                rewards.dkt += challengeRewards.dkt;
                rewards.gold += challengeRewards.softCurrency;
                rewards.hardCurrency += challengeRewards.hardCurrency;
            }
        }

        // set loot claimed
        let updateQuery = { $set: {} };
        updateQuery.$set[`loot.${userId}`] = true;

        await this._db.collection(Collections.Raids).updateOne({ _id: this.id }, updateQuery);

        return rewards;
    }

    _scheduleCheckpoint() {
        if (this.finished) {
            return;
        }

        this._checkpointTimeout = setTimeout(this._checkpoint.bind(this), Config.raids.checkpointInterval);
    }

    _publishEvent(eventData) {
        Game.publishToChannel(this.channelName, eventData);
    }

    _createChallenge(type, challengeMeta, challengeData) {
        switch (type) {
            case RaidChallengeType.TopDamageDealers:
                return new TopDamageDealers(challengeMeta, challengeData, this);
        }
    }
}

module.exports = Raid;