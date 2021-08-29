import Game from "../game"

interface RaidPointsData {
    score: number;
    lastClaimed: number;
    shares: number;
    sharesPool: number;
    pointsPool: number;
}

function toShares(amount, poolIn, poolOut) {
    return amount * poolOut / (poolIn + amount);
}

const CURVATURE = 20000;
const FLESH_EMISSION = 1000;

export class RaidPoints {
    private _user: any;
    private _data: RaidPointsData;

    constructor(data: RaidPointsData, user: any) {
        if (!data) {
            data.lastClaimed = this.getCurrentPayout();
            data.pointsPool = data.sharesPool = CURVATURE;
            data.score = data.shares = 0;
        }

        this._data = data;
        this._user = user;
    }

    getCurrentPayout() {
        return Game.raidPoints.getCurrentPayout();
    }

    async addPoints(amount: number) {
        await this.tryClaimDkt();

        const shares = toShares(amount, this._data.pointsPool, this._data.sharesPool);

        this._data.pointsPool += amount;
        this._data.sharesPool -= shares;
        this._data.shares += shares;
        this._data.score += amount;

        await Game.raidPoints.increaseTotalPoints(amount, shares);
    }

    async tryClaimDkt() {
        if (this._data.lastClaimed != this.getCurrentPayout()) {
            const data = await Game.raidPoints.getSnapshotForPayout(this._data.lastClaimed);

            if (data) {
                const dkt = this._data.shares / data.totalShares * FLESH_EMISSION;
                await this._user.addDkt(dkt);
            }

            this._data.lastClaimed = this.getCurrentPayout();
            this._data.pointsPool = this._data.sharesPool = CURVATURE;
            this._data.score = this._data.shares = 0;
        }
    }

    async getInfo() {
        return Game.raidPoints.getLatestState()
    }
}