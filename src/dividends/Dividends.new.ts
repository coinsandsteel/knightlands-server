import game from "../game";
import Game from "../game";
import { DividendsData, DividendsMeta, PayoutsPerShare } from "./types";

export class Dividends {
    private _data: DividendsData;
    private _user: any;

    constructor(data: DividendsData, user: any) {
        this._data = data;
        this._user = user;

        if (this._data.unlockedTokens === undefined) {
            this._data.unlockedTokens = 0;
            this._data.miningLevel = 0;
            this._data.dropRateLevel = 0;
            this._data.lastPayout = Game.dividends.getCurrentPayout();
            this._data.payouts = {};
        }
    }

    async tryCommitPayout() {
        if (this._data.lastPayout != Game.dividends.getCurrentPayout()) {
            // accumulate all payouts
            const payoutsPerShare = await Game.dividends.getPerShareRewards();

            for (const id in payoutsPerShare) {
                this._data.payouts[id] = (payoutsPerShare[id] * BigInt(Math.floor(this._user.dkt * 10e8)) / BigInt(10e8)).toString();
            }

            this._data.lastPayout = Game.dividends.getCurrentPayout();
        }
    }

    async claimDividends(blockchainId: string) {
        let args = null

        if (this._data.payouts[blockchainId]) {
            args = await Game.dividends.initiateWithdrawal(this._user.address, blockchainId, this._data.payouts[blockchainId]);
            this._data.payouts[blockchainId] = "0";
        }

        return args;
    }
}
