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
const FREE_FLESH_EMISSION = 35;

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

    reset() {
        this._data.lastClaimed = this.getCurrentPayout();
        this._data.pointsPool = this._data.sharesPool = CURVATURE;
        this._data.score = this._data.shares = 0;
    }

    async addPoints(amount: number) {
        await this.tryClaimDkt();

        const shares = toShares(amount, this._data.pointsPool, this._data.sharesPool);

        this._data.pointsPool += amount;
        this._data.sharesPool -= shares;
        this._data.shares += shares;
        this._data.score += amount;

        await Game.raidPoints.increaseTotalPoints(amount, shares, this._user.isFreeAccount);
    }

    async tryClaimDkt() {
        if (this._data.lastClaimed != this.getCurrentPayout()) {
            const data = await Game.raidPoints.getSnapshotForPayout(this._data.lastClaimed);

            if (data) {
                let dkt = 0;

                if (data.totalShares > 0) {
                    this._data.shares / data.totalShares * FLESH_EMISSION
                }

                if (this._user.isFreeAccount && data.totalFreeShares > 0) {
                    dkt = this._data.shares / data.totalFreeShares * FREE_FLESH_EMISSION;
                }

                if (isNaN(dkt)) {
                    dkt = 0;
                }

                await this._user.addDkt(dkt);
            }

            this.reset();
        }
    }

    async getInfo() {
        return Game.raidPoints.getLatestState()
    }
}