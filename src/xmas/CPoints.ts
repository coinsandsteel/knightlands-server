import Game from "../game"
import { CPointsData } from "./types";

function toShares(amount, poolIn, poolOut) {
    return amount * poolOut / (poolIn + amount);
}

const CURVATURE = 20000;
const FLESH_EMISSION = 250;

export class CPoints {
    private _user: any;
    private _data: CPointsData;

    constructor(data: CPointsData, user: any) {
        if (!data.lastClaimed) {
            data.lastClaimed = this.getCurrentPayout();
            data.pointsPool = data.sharesPool = CURVATURE;
            data.score = data.shares = 0;
        }

        this._data = data;
        this._user = user;
    }

    getCurrentPayout() {
        return Game.xmasManager.cpoints.getCurrentPayout();
    }

    reset() {
        this._data.lastClaimed = this.getCurrentPayout();
        this._data.pointsPool = this._data.sharesPool = CURVATURE;
        this._data.score = this._data.shares = 0;
    }

    async addPoints(amount: number) {
        await this.tryClaimDkt();

        if (isNaN(amount)) {
            return;
        }

        const shares = toShares(amount, this._data.pointsPool, this._data.sharesPool);

        this._data.pointsPool += amount;
        this._data.sharesPool -= shares;
        this._data.shares += shares;
        this._data.score += amount;

        await Game.xmasManager.cpoints.increaseTotalPoints(amount, shares);

        return this._data;
    }

    async tryClaimDkt() {
        if (this._data.lastClaimed != this.getCurrentPayout()) {
            const data = await Game.xmasManager.cpoints.getSnapshotForPayout(this._data.lastClaimed);

            if (data) {
                let dkt = 0;

                if (data.totalShares > 0) {
                    dkt = this._data.shares / data.totalShares * FLESH_EMISSION
                }

                if (isNaN(dkt)) {
                    dkt = 0;
                }

                await this._user.addDkt(dkt);

                this.reset();
            }
        }
    }

    async getInfo() {
        return Game.xmasManager.cpoints.getLatestState()
    }
}