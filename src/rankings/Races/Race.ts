import { EventEmitter } from "events";
import { Db, ObjectId } from "mongodb";
import { Collections } from "../../database/database";

import lt from "../../utils/longTimeout";
import Game from "../../game";
import Events from "../../knightlands-shared/events";

import { RaceConfiguration, RaceRecord, RaceState } from "./RaceTypes";
import { Ranking, RankingOptions, RankingRecord } from "../Ranking";
import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { Lock } from "../../utils/lock";


export class Race extends EventEmitter implements IRankingTypeHandler {
    static readonly Finished = "_evt_racefinished";

    private _db: Db;
    private _state: RaceRecord;
    private _ranking: Ranking;
    private _timeout: any;
    private _lock: Lock;

    finished: boolean;
    targetsHit: number;

    constructor(db: Db) {
        super();

        this._db = db;
        this.targetsHit = 0;
        this._lock = new Lock();
    }

    get id(): ObjectId {
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
        return Math.floor(this.config.baseTarget * this._state.targetMultiplier);
    }

    get rewards() {
        return this.config.rewards.map(x => Math.ceil(x * this._state.rewardsMultiplier))
    }

    get winners() {
        return this._state.winners;
    }

    get tableId() {
        return this._state._id.toHexString();
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
        if (this.finished) {
            return;
        }

        await this._lock.acquire("rank");

        try {
            let userRank = <RankingRecord>await this.getUserRank(userId);
            if (userRank.rank > 0 && userRank.rank <= this._state.config.rewards.length) {
                // already reached the target
                return;
            }

            const userScore = this._ranking.getParticipantScore(userId);
            const scoreLeft = this.target - userScore;

            await this._ranking.updateRank(
                userId,
                options,
                scoreLeft < value ? scoreLeft : value
            );

            if (this._ranking.getParticipantScore(userId) == this.target && this.winners.length < this._state.config.rewards.length) {
                this._state.looted[userId] = false;
                // can claim reward, track player
                await this._db.collection(Collections.Races).updateOne({ _id: this.id }, {
                    $set: { "looted": this._state.looted }, $push: {
                        winners: {
                            $each: [userId]
                        }
                    }
                });
                this._state.winners.push(userId)

                userRank = <RankingRecord>await this.getUserRank(userId);
                Game.emitPlayerEvent(userId, Events.RaceFinished, { rank: userRank.rank, race: this.id });
            }

            await this._handleRankUpdate();
        } finally {
            await this._lock.release("rank");
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
            finalDuration: 0,
            winners: []
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
        if (rank) {
            if (rank.score < this.target || rank.rank > this.config.rewards.length) {
                rank.rank = 0;
            } else {
                rank.rank = this.winners.findIndex(x => x.equals(userId)) + 1;
            }
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
        this._state.winners = this._state.winners || [];
        this._ranking = new Ranking(this._db.collection(Collections.RaceTables), this.tableId, {
            typeOptions: this._state.config.type
        });
        await this._ranking.init();
    }

    async load(id: ObjectId) {
        const state = <RaceRecord>await this._db.collection(Collections.Races).findOne({ _id: id })
        await this.loadFromState(state);
        await this._launch();
    }

    private async _launch() {
        this.finished = false;
        let duration = this._state.config.duration;
        let startTime = this._state.startTime;
        let nextFinish = duration - (Game.nowSec - startTime);
        console.log(`Race Tier ${this._state.config.tier} is going to finish in ${nextFinish} seconds.`);
        this._timeout = lt.setTimeout(this._finish.bind(this), nextFinish * 1000);
        await this._handleRankUpdate();
    }

    private async _handleRankUpdate() {
        let totalRewards = this.config.rewards.length;
        const target = this.target;
        const players = await this._ranking.getParticipants(totalRewards);
        this.targetsHit = 0;

        if (players.length > 0) {
            // results are ordered in desc order by score
            this.targetsHit = totalRewards > this.winners.length ? this.winners.length : totalRewards;

            if (this.targetsHit == this.config.rewards.length) { // short circuit race
                await this._finish();
            }
        }
    }

    private async _finish() {
        if (this.finished) {
            return;
        }

        this.finished = true;
        lt.clearTimeout(this._timeout);

        const finalDuration = this.finalDuration;

        this._state.state = RaceState.Finished;
        await this._db.collection(Collections.Races).updateOne({ _id: this.id }, { $set: { "state": RaceState.Finished, finalDuration } });

        Game.publishToChannel(Events.RaceFinished, { race: this.id });

        // let other interested services know
        this.emit(Race.Finished, this.id);
    }
}
