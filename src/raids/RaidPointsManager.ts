import Game from "../game"
import { Collections } from "../database/database";
import { Db, ObjectId } from "mongodb";
import { Lock } from "../utils/lock";

const PAYOUT_PERIOD = 86400;

export class RaidPointsManager {
    private _lastPayout: number;
    private _totalPoints: number;
    private _totalShares: number;
    private _lock: Lock;

    constructor() {
        this._totalPoints = this._totalShares = 0;
        this._lastPayout = 0;
        this._lock = new Lock()
    }

    async init() {
        const state = await Game.db.collection(Collections.DivTokenState).findOne({ _id: "raid_points_state" });
        if (state) {
            this._totalShares = state.totalShares;
            this._totalPoints = state.totalPoints;
            this._lastPayout = state.lastPayout;
        }

        await this.commitPayoutDay(Game.dbClient.db);
        this._schedulePayoutCommit();
    }

    _schedulePayoutCommit() {
        setTimeout(async () => {
            try {
                await this.commitPayoutDay(Game.dbClient.db);
            } finally {
                this._schedulePayoutCommit();
            }
        }, PAYOUT_PERIOD - Game.now % PAYOUT_PERIOD);
    }

    getCurrentPayout() {
        return Math.floor(Game.nowSec / PAYOUT_PERIOD) * PAYOUT_PERIOD;
    }

    async commitPayoutDay(db) {
        if (this._lastPayout != this.getCurrentPayout()) {
            await db.collection(Collections.RaidPointsPayouts).updateOne(
                { _id: this.getCurrentPayout() },
                { $set: { totalPoints: this._totalPoints, totalShares: this._totalShares } },
                { upsert: true }
            );

            this._totalPoints = 0;
            this._totalShares = 0;
            this._lastPayout = this.getCurrentPayout();

            await db.collection(Collections.DivTokenState).updateOne(
                { _id: "raid_points_state" },
                { $set: { lastPayout: this._lastPayout, totalPoints: this._totalPoints, totalShares: this._totalShares } },
                { upsert: true }
            );
        }
    }

    getLatestState() {
        return { totalPoints: this._totalPoints, totalShares: this._totalShares }
    }

    async getSnapshotForPayout(payout: number) {
        const data = await Game.db.collection(Collections.RaidPointsPayouts).findOne({ _id: payout });
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

                Game.publishToChannel("total_rp", { totalPoints: this._totalPoints, totalShares: this._totalShares });

                await Game.db.collection(Collections.DivTokenState).updateOne(
                    { _id: "raid_points_state" },
                    { $set: { totalPoints: this._totalPoints, totalShares: this._totalShares } },
                    { upsert: true }
                );
            })
        } finally {
            await this._lock.release("increase");
        }
    }
}