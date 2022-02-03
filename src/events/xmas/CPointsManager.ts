import Game from "../../game"
import { Collections } from "../../database/database";
import { Lock } from "../../utils/lock";

const PAYOUT_PERIOD = 86400;
const STATE_RECORD_ID = "cpoints_state";

export class CPointsManager {
    private _currentPayout: number;
    private _totalPoints: number;
    private _totalShares: number;
    private _lock: Lock;

    constructor() {
        this._totalPoints = this._totalShares = 0;
        this._currentPayout = 0;
        this._lock = new Lock()
    }

    async init() {
        const state = await Game.db.collection(Collections.DivTokenState).findOne({ _id: STATE_RECORD_ID });
        if (state) {
            this._totalShares = state.totalShares;
            this._totalPoints = state.totalPoints;
            this._currentPayout = state.lastPayout;
        }

        await Game.dbClient.withTransaction(async db => {
            await this.commitPayoutDay(db);
        })
        this._schedulePayoutCommit();
    }

    _schedulePayoutCommit() {
        setTimeout(async () => {
            try {
                await Game.dbClient.withTransaction(async db => {
                    await this.commitPayoutDay(db);
                })
            } finally {
                this._schedulePayoutCommit();
            }
        }, 1000);
    }

    getPayoutPeriod() {
        return PAYOUT_PERIOD;
    }

    getCurrentPayout() {
        return Math.floor(Game.nowSec / PAYOUT_PERIOD) * PAYOUT_PERIOD;
    }

    async commitPayoutDay(db) {
        if (this._currentPayout != this.getCurrentPayout()) {
            await db.collection(Collections.XmasPoints).updateOne(
                { _id: this._currentPayout },
                { $set: { totalPoints: this._totalPoints, totalShares: this._totalShares } },
                { upsert: true }
            );

            this._totalPoints = 0;
            this._totalShares = 0;
            this._currentPayout = this.getCurrentPayout();

            await db.collection(Collections.DivTokenState).updateOne(
                { _id: STATE_RECORD_ID },
                { $set: { lastPayout: this._currentPayout, totalPoints: 0, totalShares: 0, totalFreePoints: 0, totalFreeShares: 0 } },
                { upsert: true }
            );
        }
    }

    getLatestState() {
        return { totalPoints: this._totalPoints, totalShares: this._totalShares }
    }

    async getSnapshotForPayout(payout: number) {
        const data = await Game.db.collection(Collections.XmasPoints).findOne({ _id: payout });
        return data;
    }

    async increaseTotalPoints(points: number, shares: number) {
        await this._lock.acquire("increase");

        try {
            await Game.dbClient.withTransaction(async db => {
                // this function is going to be protected by external lock, ignore a race condition here
                await this.commitPayoutDay(db);

                this._totalPoints += points;
                this._totalShares += shares;
                Game.publishToChannel("total_cp", { totalPoints: this._totalPoints, totalShares: this._totalShares });
                

                await Game.db.collection(Collections.DivTokenState).updateOne(
                    { _id: STATE_RECORD_ID },
                    { $set: { totalPoints: this._totalPoints, totalShares: this._totalShares } },
                    { upsert: true }
                );
            })
        } finally {
            await this._lock.release("increase");
        }
    }
}