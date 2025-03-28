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
        if (!data.lastClaimed) {
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

    async rollbackRP() {
        await this.tryClaimDkt();
        await Game.raidPoints.increaseTotalPoints(-this._data.score, -this._data.shares, this._user.isFreeAccount);
        this.reset();
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

        await Game.raidPoints.increaseTotalPoints(amount, shares, this._user.isFreeAccount);
    }

    async tryClaimDkt() {
        if (this._data.lastClaimed != this.getCurrentPayout()) {
            const data = await Game.raidPoints.getSnapshotForPayout(this._data.lastClaimed);

            if (data) {
                let dkt = 0;

                if (data.totalShares > 0) {
                    dkt = this._data.shares / data.totalShares * FLESH_EMISSION
                }

                if (this._user.isFreeAccount && data.totalFreeShares > 0) {
                    dkt = this._data.shares / data.totalFreeShares * FREE_FLESH_EMISSION;
                }

                if (isNaN(dkt)) {
                    dkt = 0;
                }

                // const before = this._user.dkt;
                
                if (dkt > 0) {
                    await this._user.addDkt(dkt);
                }
                
                // before reset - save it to the external collection for the debuggin purposes
                // await Game.db.collection(`user_raid_points_${this._data.lastClaimed}`).insertOne({
                //     user: this._user.id,
                //     pointsPool: this._data.pointsPool,
                //     sharesPool: this._data.sharesPool,
                //     shares: this._data.shares,
                //     score: this._data.score,
                //     beforeDkt: before,
                //     dkt: this._user.dkt
                // })

                this.reset();
            }
        }
    }

    async getInfo() {
        return Game.raidPoints.getLatestState()
    }
}