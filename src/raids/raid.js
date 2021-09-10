'use strict';

const {
    Collections
} = require("../database/database");

const CBuffer = require("../CBuffer");
const Unit = require("../combat/unit");
import CharacterStats from "../knightlands-shared/character_stat";
import Game from "../game";
const EventEmitter = require("events");
const Events = require("../knightlands-shared/events");
const Config = require("../config");
import Random from "../random";
import Errors from "../knightlands-shared/errors";
import RankingType from "../knightlands-shared/ranking_type";

import RaidChallengeType from "../knightlands-shared/raid_challenge";
import { ObjectId } from "bson";
import CharacterStat from "../knightlands-shared/character_stat";
const TopDamageDealers = require("./topDamageDealersChallenge");

const ExtraDamagePerAdditionalHit = 0.01;

class Raid extends EventEmitter {
    constructor(db) {
        super();

        this.Hit = "hit";
        this.BossKilled = "boss-killed";

        this.TimeRanOut = "time_ran_out";
        this.Defeat = "defeat";

        this._db = db;

        this._damageLog = new CBuffer(20);
        this._challenges = [];
    }

    get id() {
        return this._data._id.toHexString();
    }

    get finished() {
        return !this._bossUnit.isAlive || this._data.timeLeft < 1;
    }

    get free() {
        return this._data.isFree;
    }

    get template() {
        return this._data.isFree ? this._template.soloData : this._template.data;
    }

    get loot() {
        return this._data.isFree ? this.template.freeLoot : this.template.paidLoot;
    }

    get templateId() {
        return +this._data.raidTemplateId;
    }

    get defeat() {
        return !this._bossUnit.isAlive;
    }

    get isPublic() {
        return this._data.public;
    }

    get summoner() {
        return this._data.summoner;
    }

    async create(summonerId, raidTemplateId, isFree, isPublic) {
        raidTemplateId *= 1;
        let raidTemplate = await this._loadRaidTemplate(raidTemplateId);
        if (!raidTemplate) {
            throw Errors.IncorrectArguments;
        }

        let raidData = isFree ? raidTemplate.soloData : raidTemplate.data;

        let raidEntry = {
            maxSlots: raidData.maxSlots,
            level: raidTemplate.level,
            summoner: summonerId,
            raidTemplateId,
            participants: {
                [summonerId]: 0
            },
            challenges: {},
            finished: false,
            loot: {
                [summonerId]: false
            },
            damageLog: [],
            isFree,
            public: isPublic
        };

        raidEntry.creationTime = Game.nowSec;
        raidEntry.duration = raidData.duration;
        raidEntry.timeLeft = Math.floor(raidEntry.duration - (Game.now / 1000 - raidEntry.creationTime));
        raidEntry.busySlots = 1; // summoner

        let bossState = {};
        bossState[CharacterStats.Health] = parseInt(raidData.health);
        bossState[CharacterStats.Attack] = parseInt(raidData.attack);
        raidEntry.bossState = bossState;

        raidEntry.weakness = await this._db.collection(Collections.RaidsWeaknessRotations).findOne({ raid: raidTemplateId });

        let insertResult = await this._db.collection(Collections.Raids).insertOne(raidEntry);
        raidEntry._id = insertResult.insertedId;

        await this._initFromData(raidEntry);
    }

    get channelName() {
        return `raid/${this.id}`;
    }

    get isFull() {
        if (this._data.isFree) {
            return true;
        }

        return this._data.busySlots >= this.template.maxSlots;
    }

    async init(data) {
        await this._initFromData(data);
    }

    async getPlayers() {
        const playerIds = new Array(this._data.busySlots);
        let idx = 0;
        for (const id in this._data.participants) {
            playerIds[idx] = new ObjectId(id);
            idx++;
        }

        return this._db.collection(Collections.Users).find({
            _id: { $in: playerIds }
        }, {
            projection: {
                level: "$character.level",
                name: "$character.name.v",
                avatar: "$character.avatar",
                _id: 1
            }
        }).toArray();
    }

    getInfo() {
        let info = {...this._data };
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
            // randomly choose up to challengeCount challenges
            let challengesToChoose = this.template.challengeCount;
            let challengesMeta = this.template.challenges;
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
        maxStats[CharacterStats.Health] = parseInt(this.template.health);
        maxStats[CharacterStats.Attack] = parseInt(this.template.attack);

        this._bossUnit = new Unit(this._data.bossState, maxStats, 1);

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

    async finish(dktFactor) {
        clearTimeout(this._checkpointTimeout);
        clearInterval(this._timerInterval);

        this._data.dktFactor = dktFactor;
        await this._checkpoint();
    }

    async _loadRaidTemplate(raidTemplateId) {
        return await this._db.collection(Collections.RaidsMeta).findOne({
            _id: raidTemplateId * 1
        });
    }

    async join(userId) {
        if (this._data.busySlots >= this.template.maxSlots) {
            throw Errors.RaidIsFull;
        }

        this._data.participants[userId] = 0;
        this._data.loot[userId] = false;
        this._data.busySlots++;

        await this._db.collection(Collections.Raids).updateOne({ _id: new ObjectId(this.id) }, {
            $set: {
                participants: this._data.participants,
                [`loot.${userId}`]: false,
                busySlots: this._data.busySlots
            }
        });
    }

    async attack(attacker, hits, legionIndex) {
        if (!this.isParticipant(attacker.id)) {
            throw Errors.InvalidRaid;
        }

        if (hits > 50) {
            hits = 50;
        }

        let combatUnit = attacker.getCombatUnit({
            raid: this._template._id
        });

        if (!combatUnit.isAlive) {
            throw Errors.NoHealth;
        }

        // check if player has enough stamina for requested hits
        if (attacker.getTimerValue(CharacterStats.Stamina) < hits * this.template.staminaCost) {
            throw Errors.NoStamina;
        }

        let bonusDamage = 1 + ExtraDamagePerAdditionalHit * (hits - 1);
        let hitsToPerform = hits;

        // apply weakness bonuses
        const attackerWeaponCombatData = await attacker.getWeaponCombatData();
        if (attackerWeaponCombatData) {
            // if element matches +30%
            // if weapon matches +30%
            if (attackerWeaponCombatData.element == this._data.weakness.current.element) {
                bonusDamage *= 1.3;
            }

            if (attackerWeaponCombatData.type == this._data.weakness.current.weapon) {
                bonusDamage *= 1.3;
            }
        }

        combatUnit.updateStats(this._data.weakness.current.element)

        const army = await Game.armyManager.createCombatLegion(attacker.address, legionIndex);
        const damageLog = {
            by: attacker.id,
            name: attacker.nickname.v,
            damage: 0,
            hits: 0
        };

        const attackLog = {
            raid: this.id,
            player: { damage: 0, crit: false },
            armyDamage: {},
            procs: {},
            health: {},
            energy: {},
            stamina: {},
            exp: 0,
            soft: 0,
            boss: { health: 0, damage: 0 }
        };

        while (hitsToPerform > 0 && combatUnit.isAlive && this._bossUnit.isAlive) {
            attackLog.exp += this.template.exp + attacker.maxStats[CharacterStat.ExpOnHitInRaid];
            attackLog.soft += this.template.gold + attacker.maxStats[CharacterStat.GoldOnHitInRaid];

            hitsToPerform--;

            // boss attacks first to avoid abusing 1 hp tactics
            attackLog.boss.damage += this._bossUnit.attack(combatUnit).damage;

            if (combatUnit.isAlive) {
                damageLog.hits++;

                const armyAttackResult = await army.attackRaid(this._bossUnit, bonusDamage, combatUnit.maxStats, this._template._id);
                const playerAttackResult = combatUnit.attackRaid(this._bossUnit, bonusDamage, armyAttackResult.playerStats.attack);

                const damageDone = playerAttackResult.damage + armyAttackResult.totalDamageOutput;
                damageLog.damage += damageDone;

                attackLog.player.damage += playerAttackResult.damage;
                attackLog.player.crit = attackLog.player.crit || playerAttackResult.crit;

                for (const unitId of army.unitIds) {
                    attackLog.armyDamage[unitId] = (attackLog.armyDamage[unitId] || 0) + armyAttackResult.unitsDamageOutput[unitId];
                    if (armyAttackResult.damageProcs[unitId]) {
                        attackLog.procs[unitId] = (attackLog.procs[unitId] || 0) + armyAttackResult.damageProcs[unitId];
                    }

                    if (armyAttackResult.health[unitId]) {
                        attackLog.health[unitId] = (attackLog.health[unitId] || 0) + armyAttackResult.health[unitId];
                        combatUnit.restoreHealth(armyAttackResult.health[unitId]);
                    }

                    if (armyAttackResult.energy[unitId]) {
                        attackLog.energy[unitId] = (attackLog.energy[unitId] || 0) + armyAttackResult.energy[unitId];
                        combatUnit.restoreEnergy(armyAttackResult.energy[unitId]);
                    }

                    if (armyAttackResult.stamina[unitId]) {
                        attackLog.stamina[unitId] = (attackLog.stamina[unitId] || 0) + armyAttackResult.stamina[unitId];
                        combatUnit.restoreStamina(armyAttackResult.stamina[unitId]);
                    }
                }

                const crit = playerAttackResult.crit;

                // notify current challenges
                this.emit(this.Hit, attacker, damageDone, crit);
            }
        }

        await attacker.modifyTimerValue(CharacterStats.Stamina, -damageLog.hits);

        if (damageLog.damage > 0) {
            this._data.participants[attacker.id] += damageLog.damage;

            this._damageLog.push(damageLog);

            attackLog.exp = await attacker.addExperience(attackLog.exp);
            attackLog.soft = await attacker.addSoftCurrency(attackLog.soft);

            this._publishEvent({ event: Events.RaidDamaged, bossHp: this._bossUnit.getHealth(), ...damageLog });

            attackLog.boss.health = this._bossUnit.getHealth();
            Game.emitPlayerEvent(attacker.address, Events.RaidDamaged, attackLog);

            // finalize challenges to detect final changes inside 
            {
                let i = 0;
                const length = this._challenges.length;
                for (; i < length; ++i) {
                    this._challenges[i].finalize();
                }
            }

            await Game.rankings.updateRank(attacker.id, {
                type: RankingType.DamageInRaids
            }, damageLog.damage);

            await Game.rankings.updateRank(attacker.id, {
                type: RankingType.DamageInParticularRaid,
                raid: this._template._id
            }, damageLog.damage);
        }

        if (!this._bossUnit.isAlive) {
            // this.emit(this.BossKilled, attacker, damageDone, crit, this._data.timeLeft);

            // emit victory and let know to raid manager
            this._publishEvent({ event: Events.RaidFinished, defeat: true });
            this.emit(this.Defeat, this);
        }

        return {
            alive: combatUnit.isAlive
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

        await this._db.collection(Collections.Raids).updateOne({ _id: new ObjectId(this.id) }, {
            $set: {
                timeLeft: this._data.timeLeft,
                bossState: this._data.bossState,
                participants: this._data.participants,
                finished: this.finished,
                damageLog: this._damageLog.toArray(),
                defeat: this.defeat,
                loot: this._data.loot,
                challenges: this._data.challenges,
                weakness: this._data.weakness
            }
        });

        this._scheduleCheckpoint();
    }

    async getRewards(user) {
        const userId = user.id;
        if (this._data.loot[userId]) {
            return this._data.loot[userId];
        }

        // determine raid loot record based on user damage
        let chosenLoot;
        let raidStage = this.template;
        let userDamage = this._data.participants[userId]; {
            let i = 0;
            let loot = this.loot;

            if (this._data.isFree) {
                const firstClearance = await this._db.collection(Collections.FreeRaidsClearance).findOneAndUpdate({ raidId: this.templateId, user: userId }, { $setOnInsert: { raidId: this.templateId, user: userId } }, { returnDocument: 'false', upsert: true });

                if (!firstClearance.value) {
                    loot = this.loot.firstClearance;
                } else {
                    loot = this.loot.repeatedClearance;
                }
            }

            const length = loot.length;
            for (; i < length; ++i) {
                if (this._data.isFree || userDamage >= raidStage.health / raidStage.maxSlots * loot[i].damageThreshold) {
                    chosenLoot = loot[i];
                } else {
                    break;
                }
            }
        }

        // all participants get at least min dkt
        let rewards = {
            rp: raidStage.minDkt,
            exp: 0,
            gold: 0,
            hardCurrency: 0,
            items: []
        };

        if (chosenLoot) {
            rewards.gold = chosenLoot.gold;

            rewards.rp = chosenLoot.dktReward * Random.range(raidStage.maxDkt * 0.9, raidStage.maxDkt);
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

                    rewards.rp += challengeRewards.dkt;
                    rewards.gold += challengeRewards.softCurrency;
                    rewards.hardCurrency += challengeRewards.hardCurrency;
                }
            }
        }

        if (this._data.isFree) {
            rewards.rp = 0;
        } else {
            rewards.rp = await user.getBonusRP(rewards.rp);

            await this._updateLoot(userId, rewards);
        }

        return rewards;
    }

    async claimLoot(user) {
        const userId = user.id;
        if (this._data.loot[userId] === true) {
            throw Errors.RaidLootClaimed;
        }

        const rewards = await this.getRewards(user);

        // set loot claimed
        await this._updateLoot(userId, true);

        return rewards;
    }

    async _updateLoot(userId, loot) {
        let updateQuery = { $set: {} };
        updateQuery.$set[`loot.${userId}`] = loot;

        this._data.loot[userId] = loot;

        await this._db.collection(Collections.Raids).updateOne({ _id: new ObjectId(this.id) }, updateQuery);
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