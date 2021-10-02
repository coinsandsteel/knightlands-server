import Game from "../game"
import { Collections } from "../database/database";
import { Db, ObjectId } from "mongodb";
import { Lock } from "../utils/lock";

const PAYOUT_PERIOD = 86400;
const STATE_RECORD_ID = "raid_points_state";

export class RaidPointsManager {
    private _currentPayout: number;
    private _totalPoints: number;
    private _totalShares: number;
    private _totalFreePoints: number;
    private _totalFreeShares: number;
    private _lock: Lock;

    constructor() {
        this._totalPoints = this._totalShares = 0;
        this._totalFreePoints = this._totalFreeShares = 0;
        this._currentPayout = 0;
        this._lock = new Lock()
    }

    async init() {
        const state = await Game.db.collection(Collections.DivTokenState).findOne({ _id: STATE_RECORD_ID });
        if (state) {
            this._totalShares = state.totalShares;
            this._totalPoints = state.totalPoints;
            this._totalFreeShares = state.totalFreeShares || 0;
            this._totalFreePoints = state.totalFreePoints || 0;
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
            await db.collection(Collections.RaidPointsPayouts).updateOne(
                { _id: this._currentPayout },
                { $set: { totalPoints: this._totalPoints, totalShares: this._totalShares, totalFreePoints: this._totalFreePoints, totalFreeShares: this._totalFreeShares } },
                { upsert: true }
            );

            this._totalPoints = 0;
            this._totalShares = 0;
            this._totalFreePoints = 0;
            this._totalFreeShares = 0;
            this._currentPayout = this.getCurrentPayout();

            await db.collection(Collections.DivTokenState).updateOne(
                { _id: STATE_RECORD_ID },
                { $set: { lastPayout: this._currentPayout, totalPoints: 0, totalShares: 0, totalFreePoints: 0, totalFreeShares: 0 } },
                { upsert: true }
            );
        }
    }

    getLatestState() {
        return { totalPoints: this._totalPoints, totalShares: this._totalShares, totalFreePoints: this._totalFreePoints, totalFreeShares: this._totalFreeShares }
    }

    async getSnapshotForPayout(payout: number) {
        const data = await Game.db.collection(Collections.RaidPointsPayouts).findOne({ _id: payout });
        return data;
    }

    async increaseTotalPoints(points: number, shares: number, isFree: boolean) {
        await this._lock.acquire("increase");

        try {
            await Game.dbClient.withTransaction(async db => {
                // this function is going to be protected by external lock, ignore a race condition here
                await this.commitPayoutDay(db);

                if (!isFree) {
                    this._totalPoints += points;
                    this._totalShares += shares;
                    Game.publishToChannel("total_rp", { totalPoints: this._totalPoints, totalShares: this._totalShares });
                } else {
                    this._totalFreePoints += points;
                    this._totalFreeShares += shares;
                    Game.publishToChannel("total_rp", { totalFreePoints: this._totalFreePoints, totalFreeShares: this._totalFreeShares });
                }

                await Game.db.collection(Collections.DivTokenState).updateOne(
                    { _id: STATE_RECORD_ID },
                    { $set: { totalPoints: this._totalPoints, totalShares: this._totalShares, totalFreePoints: this._totalFreePoints, totalFreeShares: this._totalFreeShares } },
                    { upsert: true }
                );
            })
        } finally {
            await this._lock.release("increase");
        }
    }
}