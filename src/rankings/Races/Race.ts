import { EventEmitter } from "events";
import { Db, ObjectID } from "mongodb";
import { Collections } from "../../database";

import lt from "../../utils/longTimeout";
import Game from "../../game";
import Events from "../../knightlands-shared/events";

import { RaceConfiguration, RaceRecord, RaceState } from "./RaceTypes";
import { Ranking, RankingOptions, RankingRecord } from "../Ranking";
import { IRankingTypeHandler } from "../IRankingTypeHandler";


export class Race extends EventEmitter implements IRankingTypeHandler {
    static readonly Finished = "_evt_race_finished";

    private _db: Db;
    private _state: RaceRecord;
    private _ranking: Ranking;
    private _finished: boolean;
    private _timeout: any;
    private _loaded: boolean;

    targetsHit: number;

    constructor(db: Db) {
        super();

        this._db = db;
        this._loaded = false;
        this.targetsHit = 0;
    }

    get id(): ObjectID {
        return this._state._id;
    }

    get tier() {
        return this.config.tier;
    }

    get finalDuration() {
        return this._state.finalDuration || Game.nowSec - this._state.startTime;
    }

    get type() {
        return this.config.type;
    }

    get config() {
        return this._state.config;
    }

    get target() {
        return this.config.baseTarget * this._state.targetMultiplier;
    }

    get rewards() {
        return this.config.rewards.map(x=>Math.ceil(x * this._state.rewardsMultiplier))
    }

    get winners() {
        return Object.keys(this._state.looted);
    }

    async add(userId: string) {
        await this._ranking.addRank(userId);
    }

    async remove(userId: string) {
        delete this._state.looted[userId];
        await this._db.collection(Collections.Races).updateOne({ _id: this.id }, { $set: { "looted": this._state.looted } });
        await this._ranking.removeRank(userId);
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        if (this._finished) {
            return;
        }

        let userRank = <RankingRecord>await this.getUserRank(userId);
        if (userRank.rank > 0 && userRank.rank <= this._state.config.rewards.length) {
            // already reached the target
            return;
        }
        
        await this._ranking.updateRank(userId, options, value);
        await this._handleRankUpdate();

        userRank = <RankingRecord>await this.getUserRank(userId);
        if (userRank.rank > 0 && userRank.rank <= this._state.config.rewards.length) {
            this._state.looted[userId] = false;
            // can claim reward, track player
            await this._db.collection(Collections.Races).updateOne({ _id: this.id }, { $set: { "looted": this._state.looted } });
        }
    }

    async create(config: RaceConfiguration, targetMultiplier: number, rewardsMultiplier: number) {
        const state = {
            _id: null,
            config,
            state: RaceState.Running,
            startTime: Game.nowSec,
            rewardsMultiplier,
            targetMultiplier,
            looted: {},
            finalDuration: 0
        };

        this._state = state;

        const insertionResult = await this._db.collection(Collections.Races).insertOne(state);

        state._id = insertionResult.insertedId;
        await this.loadFromState(state);
        await this._launch();

        return insertionResult.insertedId;
    }
    
    hasUser(userId: string) {
        return this._ranking.hasParticipant(userId);
    }

    async getUserRank(userId: string) {
        let rank = await this._ranking.getParticipantRank(userId);
        if (rank && (rank.score < this.target || rank.rank > this.config.rewards.length)) {
            rank.rank = 0;
        }
        return rank;
    }

    async getRankings(page: number) {
        return await this._ranking.getRankings(page);
    }

    clientInfo() {
        let info = {
            ...this._state,
            totalParticipants: this._ranking.totalParticipants()
        };
        delete info.looted;

        return info;
    }

    async loadFromState(state: RaceRecord) {
        this._state = state;
        this._ranking = new Ranking(this._db.collection(Collections.RaceTables), this._state._id, {
            typeOptions: this._state.config.type
        });
        await this._ranking.init();
    }

    async load(id: ObjectID) {
        const state = <RaceRecord>await this._db.collection(Collections.Races).findOne({ _id: id })
        await this.loadFromState(state);
        await this._launch();
    }

    private async _launch() {
        this._loaded = true;
        this._finished = false;
        let duration = this._state.config.duration;
        let startTime = this._state.startTime;
        let nextFinish = duration - (Game.nowSec - startTime);
        console.log(`Race Tier ${this._state.config.tier} is going to finish in ${nextFinish} seconds.`);
        this._timeout = lt.setTimeout(this._finish.bind(this), nextFinish * 1000);
        await this._handleRankUpdate();
    }

    private async _handleRankUpdate() {
        let totalRewards = this.config.rewards.length;
        const target = this._state.targetMultiplier * this._state.config.baseTarget;
        const players = await this._ranking.getParticipants();
        if (players.length > 0) {
            // results are ordered in desc order by score
            let i = 0;
            totalRewards = totalRewards > players.length ? players.length : totalRewards;
            for (; i < totalRewards; ++i) {
                if (players[totalRewards-1].score >= target) {
                    this.targetsHit++;
                } else {
                    break;
                }
            }

            if (i ==  this.config.rewards.length) {
                await this._finish();
            }
        }
    }

    private async _finish() {
        if (this._finished) {
            return;
        }

        this._finished = true;
        lt.clearTimeout(this._timeout);

        const users = await this._ranking.getParticipants();
        for (const user of users) {
            // let user know that tournament is finished
            Game.emitPlayerEvent(user.id, Events.RaceFinished, this.id);
        }

        const finalDuration = this.finalDuration;

        this._state.state = RaceState.Finished;
        await this._db.collection(Collections.Races).updateOne({ _id: this.id }, { $set: { "state": RaceState.Finished, finalDuration } });

        // let other interested services know
        this.emit(Race.Finished, this.id);
    }
}