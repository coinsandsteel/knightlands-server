import Game from "../game";
import CurrencyType from "../knightlands-shared/currency_type";
import { DividendsData, DividendsMeta, PayoutsPerShare } from "./types";
import { DividendsRegistry, TOKEN_WITHDRAWAL, DIVS_WITHDRAWAL } from "./DividendsRegistry"
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
            this._data.claimed = {};
        }

        if (!this._data.claimed) {
            this._data.claimed = {};
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

        // if (this._data.season != Game.season.getSeason()) {
        //     this._data.season = Game.season.getSeason();
        //     await this._user.addStakedDkt(-this._user.stakedDkt);
        // }
    }

    // async stake(amount: number) {
    //     if (!isNumber(amount)) {
    //         throw errors.IncorrectArguments;
    //     }
    //     amount = +amount;

    //     if (this._user.dkt < amount) {
    //         throw errors.NotEnoughCurrency;
    //     }

    //     await this._user.addDkt(-amount);
    //     await this._user.addStakedDkt(amount);
    //     await Game.dividends.increaseTotalStake(amount);
    // }

    async applyBonusDkt(value: number) {
        const meta: DividendsMeta = await this._getMeta();
        if (this._data.dropRateLevel > 0) {
            value *= (1 + meta.dropRate[this._data.dropRateLevel - 1].rate);
        }

        return value;
    }

    async upgradeDktDropRate() {
        const meta: DividendsMeta = await this._getMeta();

        if (this._data.dropRateLevel >= meta.dropRate.length) {
            throw errors.IncorrectArguments;
        }

        const price = meta.dropRate[this._data.dropRateLevel].price;

        if (this._user.dkt >= price) {
            this._data.dropRateLevel++;
            await this._user.inventory.modifyCurrency(CurrencyType.Dkt, -price);
        }
    }

    async upgradeDktMine() {
        await this.claimMinedDkt();

        const meta: DividendsMeta = await this._getMeta();
        const price = Math.pow(meta.mining.price.base * (this._data.miningLevel + 1), meta.mining.price.factor);

        if (this._user.dkt >= price) {
            this._data.miningLevel++;
            await this._user.inventory.modifyCurrency(CurrencyType.Dkt, -price);
        }
    }

    async claimMinedDkt() {
        let mined = 0;
        if (this._data.miningLevel > 0) {
            const timePassed = Game.nowSec - this._data.lastMiningUpdate;
            if (timePassed > 0) {
                const meta = await this._getMeta();
                const rate = Math.pow(meta.mining.rate.base * this._data.miningLevel, meta.mining.rate.factor) / 86400; // rate is per 1 day
                mined = await this._user.getBonusRP(timePassed * rate);
                await this._user.addRP(mined);
            }
        }

        this._data.lastMiningUpdate = Game.nowSec;

        return mined;
    }

    async getPendingWithdrawal(chain: string, tokens: boolean) {
        return Game.dividends.getPendingTransactions(this._user.id, chain, tokens);
    }

    async cancelAction({ type, id }) {
        if (type == TOKEN_WITHDRAWAL) {
            await Game.dividends.cancelTokenWithdrawal(this._user.id, id);
        } else if (type == DIVS_WITHDRAWAL) {
            const result = await Game.dividends.cancelDividendsWithdrawal(this._user.id, id);
            const claimedAmount = this._data.claimed[result.chain] ? BigInt(this._data.claimed[result.chain]) : BigInt(0)
            this._data.claimed[result.chain] = (claimedAmount + BigInt(result.amount)).toString()
        }
    }

    async withdrawTokens(to: string, currencyType: string, blockchainId: string, amount: number) {
        const pendingRecords = await this.getPendingWithdrawal(blockchainId, true);
        if (pendingRecords && pendingRecords.length != 0) {
            throw errors.DividendsWithdrawalPending;
        }

        return Game.dividends.initiateTokenWithdrawal(this._user.address, to, currencyType, blockchainId, amount);
    }

    async withdrawDividends(to: string, blockchainId: string) {
        let args = null

        const pendingRecords = await this.getPendingWithdrawal(blockchainId, false);
        if (pendingRecords && pendingRecords.length != 0) {
            throw errors.DividendsWithdrawalPending;
        }

        if (this._data.claimed[blockchainId] && BigInt(this._data.claimed[blockchainId]) > 0) {
            args = await Game.dividends.initiateDividendsWithdrawal(this._user.id, to, blockchainId, this._data.claimed[blockchainId]);
            this._data.claimed[blockchainId] = "0";
        }

        return args;
    }

    async claimDividends(blockchainId: string) {
        let args = null

        if (this._data.payouts[blockchainId] && BigInt(this._data.payouts[blockchainId]) > 0) {
            args = await Game.dividends.claimDividends(this._user.address, blockchainId, this._data.payouts[blockchainId]);
            const claimedAmount = this._data.claimed[blockchainId] ? BigInt(this._data.claimed[blockchainId]) : BigInt(0)
            this._data.claimed[blockchainId] = (claimedAmount + BigInt(this._data.payouts[blockchainId])).toString()
            this._data.payouts[blockchainId] = "0";
        }
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
