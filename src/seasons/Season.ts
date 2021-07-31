import Game from "../game";
import { Collections } from "../database/database";
import lt from 'long-timeout';

export class Season {
    private _seasonTimeout: any;
    private _season: number;
    private _finishAt: number;

    constructor() {
    }

    async init() {
        const state = await Game.db.collection(Collections.Seasons).findOne({ _id: "state" });
        if (state) {
            this._season = state.season;
            this._finishAt = state.finishAt;

            // align to the next payout
            const payoutPeriod = Game.dividends.getPayoutPeriod();
            this._finishAt += (payoutPeriod - this._finishAt % payoutPeriod);
        } else {
            await this._updateSeason(1);
        }
    }

    async checkSeason() {
        if (this.isFinished()) {
            setImmediate(this._finishSeason.bind(this));
        } else {
            this._seasonTimeout = lt.setTimeout(this._finishSeason.bind(this), (this._finishAt - Game.nowSec) * 1000);
        }
    }

    getStatus() {
        return {
            season: this._season,
            finishAt: this._finishAt
        }
    }

    getSeason() {
        return this._season;
    }

    isFinished() {
        return this._finishAt < Game.nowSec;
    }

    private async _finishSeason() {
        lt.clearTimeout(this._seasonTimeout);

        // log season stats
        await Game.db.collection(Collections.Seasons).insertOne({
            season: this._season,
            finishAt: this._finishAt,
            supply: Game.dividends.getSupply()
        });

        await Game.dividends.onSeasonFinished();
        // get season schedule 
        await this._updateSeason(this._season + 1);
    }

    private async _updateSeason(nextSeason: number) {
        const schedule = await Game.db.collection(Collections.SeasonsSchedule).findOne({ season: { $gte: nextSeason } });
        if (schedule) {
            await Game.db.collection(Collections.Seasons).updateOne(
                { _id: "state" },
                { $set: { season: schedule.season, finishAt: Game.nowSec + schedule.duration } },
                { upsert: true }
            );
            await this.init()
        }
    }
}
