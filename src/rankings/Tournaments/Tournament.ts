import { EventEmitter } from "events";
import { Db, ObjectId } from "mongodb";
import { Collections } from "../../database/database";

import lt from "../../utils/longTimeout";
import Game from "../../game";
import Events from "../../knightlands-shared/events";

import { TournamentRecord, TournamentState, TournamentRewardsMeta, TournamentDivTokenRewards } from "./TournamentTypes";
import { Ranking, RankingOptions } from "../Ranking";
import { IRankingTypeHandler } from "../IRankingTypeHandler";

export class Tournament extends EventEmitter implements IRankingTypeHandler {
    static readonly Finished = "_evt_tournament_finished";

    private _db: Db;
    private _state: TournamentRecord;
    private _ranking: Ranking;

    constructor(db: Db) {
        super();
        this._db = db;
    }

    get id(): ObjectId {
        return this._state._id;
    }

    get tier() {
        return this._state.tier;
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        await this._ranking.updateRank(userId, options, value);
    }

    async remove(userId: string) {
        delete this._state.looted[userId];
        await this._db.collection(Collections.Tournaments).updateOne({ _id: this.id }, { $set: { "looted": this._state.looted } });
        await this._ranking.removeRank(userId);
    }

    async add(userId: string) {
        this._state.looted[userId] = false;
        await this._db.collection(Collections.Tournaments).updateOne({ _id: this.id }, { $set: { "looted": this._state.looted } });
        await this._ranking.addRank(userId);
    }

    async create(tier: string | number, typeOptions: RankingOptions, duration: number, rewards: TournamentRewardsMeta, divTokenRewards: TournamentDivTokenRewards) {
        const state = {
            tier,
            state: TournamentState.Running,
            startTime: Game.nowSec,
            duration,
            rewards,
            _id: null,
            looted: {},
            divTokenRewards,
            rankingState: {
                typeOptions
            }
        };

        this._state = state;

        const insertionResult = await this._db.collection(Collections.Tournaments).insertOne(state);

        state._id = insertionResult.insertedId;
        await this.loadFromState(state);
        await this._launch();

        return insertionResult.insertedId;
    }

    clientInfo() {
        let info = {
            ...this._state,
            totalParticipants: this._ranking.totalParticipants()
        };
        delete info.looted;

        return info;
    }

    async loadFromState(state: TournamentRecord) {
        this._state = state;
        this._ranking = new Ranking(this._db.collection(Collections.TournamentTables), this._state._id.toHexString(), this._state.rankingState);
        await this._ranking.init();
    }

    hasUser(userId: string) {
        return this._ranking.hasParticipant(userId);
    }

    async load(id: ObjectId) {
        const state = <TournamentRecord>await this._db.collection(Collections.Tournaments).findOne({ _id: id })
        await this.loadFromState(state);
        this._launch();
    }

    async getUserRank(userId: string) {
        return this._ranking.getParticipantRank(userId);
    }

    async getRankings(page: number) {
        return await this._ranking.getRankings(page);
    }

    private async _launch() {
        let duration = this._state.duration;
        let startTime = this._state.startTime;
        let nextFinish = duration - (Game.nowSec - startTime);
        console.log(`Tournament Tier ${this._state.tier} is going to finish in ${nextFinish} seconds.`);
        if (nextFinish <= 1) {
            nextFinish = 1;
        }
        lt.setTimeout(this._finish.bind(this), nextFinish * 1000);
    }

    private async _finish() {
        Game.publishToChannel(Events.TournamentFinished, { id: this.id });
        this._state.state = TournamentState.Finished;
        await this._db.collection(Collections.Tournaments).updateOne({ _id: this.id }, { $set: { "state": TournamentState.Finished } });

        // let other interested services know
        this.emit(Tournament.Finished, this.id);
    }
};
