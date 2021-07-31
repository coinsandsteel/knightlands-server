import Game from "../game";
import CurrencyType from "../knightlands-shared/currency_type";
import { DividendsData, DividendsMeta, PayoutsPerShare } from "./types";
import { DividendsRegistry } from "./DividendsRegistry"
import { Collections } from "../database/database";
import errors from "../knightlands-shared/errors";
import { isNumber } from "../validation";

export class Dividends {
    private _data: DividendsData;
    private _user: any;
    private _meta: DividendsMeta;

    constructor(data: DividendsData, user: any) {
        this._data = data;
        this._user = user;

        if (this._data.unlockedTokens === undefined) {
            this._data.unlockedTokens = 0;
            this._data.miningLevel = 0;
            this._data.dropRateLevel = 0;
            this._data.lastMiningUpdate = 0;
            this._data.lastPayout = Game.dividends.getCurrentPayout();
            this._data.payouts = {};
        }
    }

    get currentStake() {
        return this._data.stake;
    }

    async tryCommitPayout() {
        if (this._data.lastPayout != Game.dividends.getCurrentPayout()) {
            // accumulate all payouts
            const payoutsPerShare = await Game.dividends.getPerShareRewards();

            for (const id in payoutsPerShare) {
                if (payoutsPerShare[id] == BigInt(0)) {
                    continue;
                }

                this._data.payouts[id] = (
                    payoutsPerShare[id] *
                    BigInt(Math.floor(this._user.stakedDkt * DividendsRegistry.DktDecimals)) /
                    BigInt(DividendsRegistry.DktDecimals) /
                    BigInt(DividendsRegistry.DivsPrecision)
                ).toString();
            }

            this._data.lastPayout = Game.dividends.getCurrentPayout();
        }

        if (this._data.season != Game.season.getSeason()) {
            this._data.season = Game.season.getSeason();
            await this._user.addStakedDkt(-this._user.stakedDkt);
        }
    }

    async stake(amount: number) {
        if (!isNumber(amount)) {
            throw errors.IncorrectArguments;
        }
        amount = +amount;

        if (this._user.hardCurrency < amount) {
            throw errors.NotEnoughCurrency;
        }

        await this._user.addDkt(-amount);
        await this._user.addStakedDkt(amount);
        await Game.dividends.increaseTotalStake(amount);
    }

    async applyBonusDkt(value: number) {
        const meta: DividendsMeta = await this._getMeta();
        if (this._data.dropRateLevel > 0) {
            value *= (1 + meta.dropRates[this._data.dropRateLevel - 1].rate);
        }

        return value;
    }

    async upgradeDktDropRate() {
        const meta: DividendsMeta = await this._getMeta();

        if (this._data.dropRateLevel >= meta.dropRates.length) {
            throw errors.IncorrectArguments;
        }

        const price = meta.dropRates[this._data.dropRateLevel].price;

        if (this._data.unlockedTokens >= price) {
            this._data.dropRateLevel++;
            this._data.unlockedTokens -= price;
        }
    }

    async upgradeDktMine() {
        await this.claimMinedDkt();

        const meta: DividendsMeta = await this._getMeta();
        const price = Math.pow(meta.mining.price.base * (this._data.miningLevel + 1), meta.mining.price.factor);

        if (this._data.unlockedTokens >= price) {
            this._data.miningLevel++;
            this._data.unlockedTokens -= price;
        }
    }

    async claimMinedDkt() {
        if (this._data.miningLevel > 0) {
            const timePassed = Game.nowSec - this._data.lastMiningUpdate;
            if (timePassed > 0) {
                const meta = await this._getMeta();
                const rate = Math.pow(meta.mining.rate.base * this._data.miningLevel, meta.mining.rate.factor) / 86400; // rate is per 1 day
                const mined = timePassed * rate;
                await this._user.inventory.modifyCurrency(CurrencyType.Dkt, mined);
                this._data.lastMiningUpdate = Game.nowSec;

                return mined;
            }
        }

        return 0;
    }

    async withdrawTokens(to: string, currencyType: string, blockchainId: string, amount: number) {
        return Game.dividends.initiateTokenWithdrawal(this._user.address, to, currencyType, blockchainId, amount);
    }

    async claimDividends(to: string, blockchainId: string) {
        let args = null

        if (this._data.payouts[blockchainId]) {
            args = await Game.dividends.initiateDividendsWithdrawal(this._user.address, to, blockchainId, this._data.payouts[blockchainId]);
            this._data.payouts[blockchainId] = "0";
        }

        return args;
    }

    async purchase(itemId: number) {
        const meta = await this._getMeta();
        const item = meta.shop[itemId];
        if (!item) {
            throw errors.UnknownLot;
        }

        if (this._data.unlockedTokens >= item.price) {
            this._data.unlockedTokens -= item.price;
            await this._user.inventory.addItemTemplate(item.item, item.quantity);
        }
    }

    private async _getMeta() {
        if (!this._meta) {
            this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "dividends" });
        }

        return this._meta;
    }
}
