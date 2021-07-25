import Game from "../game";
import { ObjectID } from "mongodb";
import { Collections } from "../database";
import { Blockchain, PurchaseData, DivsWithdrawalData } from "../blockchain/Blockchain";
import { Lock } from "../utils/lock";
import { Season } from "../seasons/Season";
import { PayoutsPerShare } from "./types";
import Errors from "../knightlands-shared/errors";
import CurrencyType from "../knightlands-shared/currency_type";

const PAYOUT_PERIOD = 86400;
const PAYOUT_LAG = 10;

export class DividendsRegistry {
    private _supply: number;
    private _lock: Lock;
    private _blockchain: Blockchain;
    private _season: Season;
    private _lastPayout: number;
    private _totalStake: number;

    constructor(blockchain: Blockchain, season: Season) {
        this._season = season;

        this._blockchain = blockchain;
        this._blockchain.on(Blockchain.Payment, this.handleRewards.bind(this));
        this._blockchain.on(Blockchain.DividendWithdrawal, this.handleDivsWithdawal.bind(this));
        this._blockchain.on(Blockchain.TokenWithdrawal, this.handleTokenWithdawal.bind(this));

        this._lock = new Lock();
    }

    static get DktDecimals() {
        return 1000000;
    }

    static get DivsPrecision() {
        return BigInt(1000000);
    }

    async init() {
        this._supply = 0;
        this._lastPayout = 0;
        this._totalStake = 0;

        const state = await Game.db.collection(Collections.DivTokenState).findOne({ _id: this._season.getSeason() });
        if (state) {
            this._totalStake = state.stake;
            this._supply = state.supply;
            this._totalStake = state.stake || 0;
            this._lastPayout = state.lastPayout;
        }

        await this.commitPayoutDay();
        this._schedulePayoutCommit();
    }

    _schedulePayoutCommit() {
        setTimeout(async () => {
            try {
                await this.commitPayoutDay();
            } finally {
                this._schedulePayoutCommit();
            }
        }, PAYOUT_PERIOD - Game.now % PAYOUT_PERIOD);
    }

    async handleTokenWithdawal(blockchainId: string, data: DivsWithdrawalData) {
        await this._lock.acquire("divs");
        try {
            await Game.db.collection(Collections.TokenWithdrawalRequests)
                .updateOne({
                    _id: new ObjectID(data.withdrawalId)
                }, { $set: { pending: false } });
        } finally {
            await this._lock.release("divs");
        }
    }

    async handleDivsWithdawal(blockchainId: string, data: DivsWithdrawalData) {
        await this._lock.acquire("withdrawal");
        try {
            await Game.db.collection(Collections.DivsWithdrawalRequests)
                .updateOne({
                    _id: new ObjectID(data.withdrawalId)
                }, { $set: { pending: false, transactionHash: data.transactionHash, to: data.to } });
        } finally {
            await this._lock.release("withdrawal");
        }
    }

    async handleRewards(chainId: string, data: PurchaseData) {
        await this._lock.acquire("divs");
        try {
            const state = await Game.db.collection(Collections.DivTokenState)
                .findOne({ _id: "payouts" });

            let amount = BigInt(0);

            if (state && state.payouts[chainId]) {
                amount = BigInt(state.payouts[chainId]);
            }

            amount += BigInt(data.divs);

            await Game.db.collection(Collections.DivTokenState)
                .updateOne(
                    { _id: "payouts" },
                    { $set: { [`payouts.${chainId}`]: amount.toString() } },
                    { upsert: true }
                );

        }
        finally {
            await this._lock.release("divs");
        }
    }

    async getPerShareRewards(): Promise<PayoutsPerShare> {
        const payouts: PayoutsPerShare = {};

        const todayPayout = await Game.db.collection(Collections.DivsPayouts).findOne({ _id: this.getCurrentPayout() });
        if (todayPayout) {
            if (todayPayout.stake > 0) {
                for (const id in todayPayout.payouts) {
                    payouts[id] =
                        BigInt(todayPayout.payouts[id]) *
                        BigInt(DividendsRegistry.DktDecimals) *
                        DividendsRegistry.DivsPrecision /
                        BigInt(Math.floor(todayPayout.stake * DividendsRegistry.DktDecimals)) *
                        BigInt(PAYOUT_LAG) / BigInt(100);
                }
            }
        }

        return payouts;
    }

    getDivTokenRate() {
        if (this._supply == 0) {
            return 1;
        }

        return 1 / (0.01 * Math.log2(this._supply) / Math.log2(1.5) + 1);
    }

    async commitPayoutDay() {
        if (this._lastPayout != this.getCurrentPayout()) {
            const payouts = await Game.db.collection(Collections.DivTokenState)
                .findOne({ _id: "payouts" });

            await Game.db.collection(Collections.DivsPayouts).updateOne(
                { _id: this.getCurrentPayout() },
                { $set: { supply: this._supply, payouts: payouts ? payouts.payouts : {}, stake: this._totalStake } },
                { upsert: true }
            );

            this._lastPayout = this.getCurrentPayout();

            await Game.db.collection(Collections.DivTokenState).updateOne(
                { _id: "state" },
                { $set: { lastPayout: this._lastPayout } },
                { upsert: true }
            );
        }
    }

    async increaseTotalStake(amount: number) {
        await this._commitTotalStake(this._totalStake + amount);
    }

    async increaseSupply(amount: number) {
        // this function is going to be protected by external lock, ignore a race condition here
        await this.commitPayoutDay();

        this._supply += amount;

        await Game.db.collection(Collections.DivTokenState).updateOne(
            { _id: this._season.getSeason() },
            { $set: { supply: this._supply } },
            { upsert: true }
        );
    }

    getPayoutPeriod() {
        return PAYOUT_PERIOD;
    }

    getCurrentPayout() {
        return Math.floor(Game.nowSec / PAYOUT_PERIOD) * PAYOUT_PERIOD;
    }

    getNextPayout() {
        return this.getCurrentPayout() + PAYOUT_PERIOD;
    }

    async onSeasonFinished() {
        await this._commitTotalStake(0);
    }

    async getPendingTokenWithdrawals(userId: string) {
        return Game.db.collection(Collections.TokenWithdrawalRequests).find({ userId, pending: true }).toArray();
    }

    async initiateTokenWithdrawal(userId: string, to: string, type: string, blockchainId: string, amount: number) {
        if ((type != CurrencyType.Dkt && type != CurrencyType.Dkt2) || amount < 0) {
            throw Errors.IncorrectArguments;
        }

        await this._lock.acquire("withdrawal");

        const user = await Game.loadUser(userId);
        if (user.inventory.getCurrency(type) < amount) {
            throw Errors.NotEnoughCurrency;
        }

        try {
            const bigAmount = this._blockchain.getBlockchain(blockchainId).getBigIntDivTokenAmount(amount);
            const nonce = Number(await this._blockchain.getBlockchain(blockchainId).getPaymentNonce(userId));

            let inserted = await Game.db.collection(Collections.TokenWithdrawalRequests).insertOne({
                userId,
                blockchainId,
                type,
                date: Game.now,
                pending: true,
                amount: bigAmount.toString(),
                nonce
            });

            let withdrawalId = inserted.insertedId.valueOf() + "";
            let signature = await this._blockchain.getBlockchain(blockchainId).sign(to, withdrawalId, amount, nonce);

            await Game.db.collection(Collections.TokenWithdrawalRequests)
                .updateOne({ _id: new ObjectID(withdrawalId) }, { $set: { signature } });

            await user.inventory.modifyCurrency(type, -amount);

            return {
                signature,
                nonce,
                amount
            };
        } finally {
            await this._lock.release("withdrawal");
        }
    }

    async getPendingDivsWithdrawals(userId: string) {
        return Game.db.collection(Collections.DivsWithdrawalRequests).find({ userId, pending: true }).toArray();
    }

    async initiateDividendsWithdrawal(userId: string, to: string, blockchainId: string, amount: string) {
        await this._lock.acquire("divs");
        try {
            const nonce = Number(await this._blockchain.getBlockchain(blockchainId).getPaymentNonce(to));

            let inserted = await Game.db.collection(Collections.DivsWithdrawalRequests).insertOne({
                userId,
                blockchainId,
                date: Game.now,
                pending: true,
                amount,
                nonce
            });

            let withdrawalId = inserted.insertedId.valueOf() + "";
            let signature = await this._blockchain.getBlockchain(blockchainId).sign(to, withdrawalId, +amount, nonce);

            await Game.db.collection(Collections.DivsWithdrawalRequests)
                .updateOne({ _id: new ObjectID(withdrawalId) }, { $set: { signature } });

            const state = await Game.db.collection(Collections.DivTokenState)
                .findOne({ _id: "payouts" });

            if (state && state.payouts) {
                const current = this._toBigIntAmount(state.payouts[blockchainId] || 0);
                const reward = this._toBigIntAmount(amount);

                if (current > reward) {
                    await Game.db.collection(Collections.DivTokenState)
                        .updateOne({ _id: "payouts" }, { $set: { [`payouts.${blockchainId}`]: (current - reward).toString() } });

                    await Game.db.collection(Collections.DivsWithdrawals)
                        .insertOne({ to, userId, blockchain: blockchainId, amount, availableAmount: current.toString() });
                } else {
                    await Game.db.collection(Collections.DivsWithdrawals)
                        .insertOne({ to, userId, blockchain: blockchainId, amount, error: "NOT_ENOUGH_FUNDS", availableAmount: current.toString() });
                }
            }

            return {
                signature,
                nonce,
                amount
            };
        } finally {
            await this._lock.release("divs");
        }
    }

    getSupply() {
        return this._supply;
    }

    async getStatus(userId: string) {
        const pools = await Game.db.collection(Collections.DivsPayouts).findOne({ _id: this.getCurrentPayout() });
        return {
            season: this._season.getStatus(),
            supply: this.getSupply(),
            totalStake: this._totalStake,
            nextPayout: this.getNextPayout(),
            pendingDivs: await this.getPendingDivsWithdrawals(userId),
            pools: pools ? pools.payouts : {}
        };
    }

    private _toBigIntAmount(value: string): bigint {
        let bigValue = BigInt(value);
        if (bigValue < 0) {
            throw Errors.IncorrectArguments;
        }
        return bigValue;
    }

    private async _commitTotalStake(newStake: number) {
        await this._lock.acquire("inc_stake");
        try {
            await this.commitPayoutDay();

            this._totalStake = newStake;

            await Game.db.collection(Collections.DivTokenState).updateOne(
                { _id: this._season.getSeason() },
                { $set: { stake: this._totalStake } },
                { upsert: true }
            );
        } finally {
            await this._lock.release("inc_stake");
        }
    }
}
