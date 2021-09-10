import Game from "../game";
import { Db, ObjectId } from "mongodb";
import { Collections } from "../database/database";
import { Blockchain, PurchaseData, DivsWithdrawalData, TokenWithdrawalData, Withdrawal } from "../blockchain/Blockchain";
import { Lock } from "../utils/lock";
import { Season } from "../seasons/Season";
import { PayoutsPerShare } from "./types";
import Errors from "../knightlands-shared/errors";
import CurrencyType from "../knightlands-shared/currency_type";
import events from "../knightlands-shared/events";

const PAYOUT_PERIOD = 86400;
const PAYOUT_LAG = 5;
const WITHDRAWAL_TIMEOUT = 600; // 10 minutes
const WITHDRAWAL_CANCEL_JITTER = 250;
export const TOKEN_WITHDRAWAL = "token-w";
export const DIVS_WITHDRAWAL = "divs-w";

function toDecimal(num, decimals) {
    let str = num.toString();
    let decimal = "";
    if (str != "0") {
        if (str.length < decimals) {
            str = str.padStart(decimals, "0");
            decimal = "0." + str.slice(0, str.length);
        } else {
            decimal =
                str.slice(0, str.length - decimals) +
                "." +
                str.slice(str.length - decimals);
        }
    }
    return decimal.replace(/(\.[0-9]*[1-9])0+$|\.0*$/, "$1") || "0";
}

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
        this._blockchain.on(Blockchain.DividendTokenWithdrawal, this.handleTokenWithdawal.bind(this));
        this._blockchain.on(Blockchain.BurntTokenWithdrawal, this.handleTokenWithdawal.bind(this));

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
            this._supply = state.supply || 0;
            this._totalStake = state.stake || 0;
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

    async handleTokenWithdawal(blockchainId: string, data: TokenWithdrawalData) {
        await this._lock.acquire("token_withdrawal");
        try {
            const record = await Game.activityHistory.update(Game.db, {
                _id: new ObjectId(data.withdrawalId)
            }, { pending: false, token: data.token, transactionHash: data.transactionHash, to: data.to });
            Game.emitPlayerEvent(record.user, events.TokenWithdrawal, { id: data.withdrawalId })
        } finally {
            await this._lock.release("token_withdrawal");
        }
    }

    async handleDivsWithdawal(blockchainId: string, data: DivsWithdrawalData) {
        await this._lock.acquire("withdrawal");
        try {
            const record = await Game.activityHistory
                .update(Game.db, {
                    _id: new ObjectId(data.withdrawalId)
                }, { pending: false, transactionHash: data.transactionHash, to: data.to });
            console.log(record)
            Game.emitPlayerEvent(record.user, events.DivTokenWithdrawal, { id: data.withdrawalId })
        } finally {
            await this._lock.release("withdrawal");
        }
    }

    async handleRewards(chainId: string, data: PurchaseData) {
        await this._lock.acquire("divs");
        try {
            await Game.dbClient.withTransaction(async db => {
                const state = await db.collection(Collections.DivTokenState)
                    .findOne({ _id: "payouts" });

                let amount = BigInt(0);

                if (state && state.payouts[chainId]) {
                    amount = BigInt(state.payouts[chainId]);
                }

                amount += BigInt(data.divs);

                const payouts = { [`payouts.${chainId}`]: amount.toString() };
                await db.collection(Collections.DivTokenState)
                    .updateOne(
                        { _id: "payouts" },
                        { $set: payouts },
                        { upsert: true }
                    );

                Game.publishToChannel("divs_info", { pools: payouts });
            })
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

    async commitPayoutDay(db) {
        if (this._lastPayout != this.getCurrentPayout()) {
            const payouts = await db.collection(Collections.DivTokenState)
                .findOne({ _id: "payouts" });

            await db.collection(Collections.DivsPayouts).updateOne(
                { _id: this.getCurrentPayout() },
                { $set: { supply: this._supply, payouts: payouts ? payouts.payouts : {}, stake: this._totalStake } },
                { upsert: true }
            );

            this._lastPayout = this.getCurrentPayout();

            await db.collection(Collections.DivTokenState).updateOne(
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
        await Game.dbClient.withTransaction(async db => {
            // this function is going to be protected by external lock, ignore a race condition here
            await this.commitPayoutDay(db);

            this._supply += amount;

            await Game.db.collection(Collections.DivTokenState).updateOne(
                { _id: this._season.getSeason() },
                { $set: { supply: this._supply } },
                { upsert: true }
            );

            Game.publishToChannel("divs_info", { supply: this._supply });
        })
    }

    getPayoutPeriod() {
        return PAYOUT_PERIOD;
    }

    getWithdrawalTimeout() {
        return Game.nowSec + WITHDRAWAL_TIMEOUT;
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

    async initiateTokenWithdrawal(userId: string, to: string, type: string, blockchainId: string, amount: number) {
        if ((type != CurrencyType.Dkt && type != CurrencyType.Dkt2) || amount < 0) {
            throw Errors.IncorrectArguments;
        }

        await this._lock.acquire("withdrawal");

        const user = await Game.getUser(userId);
        if (user.inventory.getCurrency(type) < amount) {
            throw Errors.NotEnoughCurrency;
        }

        try {
            return await Game.dbClient.withTransaction(async db => {
                const chain = this._blockchain.getBlockchain(blockchainId);
                const bigAmount = chain.getBigIntDivTokenAmount(amount);
                const nonce = Number(await chain.getTokenNonce(to, type));
                const deadline = this.getWithdrawalTimeout();

                let withdrawalId = await this._createWithdrawal(db, userId, TOKEN_WITHDRAWAL, blockchainId, {
                    user: userId,
                    chain: blockchainId,
                    currency: type,
                    date: Game.now,
                    pending: true,
                    amount: bigAmount.toString(),
                    nonce,
                    to,
                    token: chain.getTokenAddress(type),
                    deadline
                });

                let signature = await chain.sign(chain.getTokenAddress(type), to, withdrawalId, bigAmount, nonce, deadline);

                await Game.activityHistory.update(db, { _id: new ObjectId(withdrawalId) }, { signature });

                await user.inventory.modifyCurrency(type, -amount);

                return {
                    _id: withdrawalId,
                    signature,
                    nonce,
                    deadline,
                    amount: bigAmount.toString()
                };
            })
        } finally {
            await this._lock.release("withdrawal");
        }
    }

    async claimDividends(userId: string, blockchainId: string, amount: string) {
        return await Game.dbClient.withTransaction(async db => {
            const state = await db.collection(Collections.DivTokenState)
                .findOne({ _id: "payouts" });

            if (state && state.payouts) {
                const current = this._toBigIntAmount(state.payouts[blockchainId] || 0);
                const reward = this._toBigIntAmount(amount);

                if (current > reward) {
                    console.log(current, reward, current - reward)
                    await db.collection(Collections.DivTokenState)
                        .updateOne({ _id: "payouts" }, { $set: { [`payouts.${blockchainId}`]: (current - reward).toString() } });
                } else {
                    await db.collection(Collections.DivsWithdrawals)
                        .insertOne({ userId, blockchain: blockchainId, amount, error: "NOT_ENOUGH_FUNDS", availableAmount: current.toString() });

                    throw Errors.NoDividendsWithdrawal;
                }
            }
        })
    }

    async initiateDividendsWithdrawal(userId: string, to: string, blockchainId: string, amount: string) {
        await this._lock.acquire("divs");
        try {
            if (await Game.activityHistory.hasRecord(userId, { pending: true, token: 'native' })) {
                throw Errors.DividendsWithdrawalPending;
            }

            const nonce = Number(await this._blockchain.getBlockchain(blockchainId).getPaymentNonce(to));
            return await Game.dbClient.withTransaction(async db => {
                const deadline = this.getWithdrawalTimeout();
                let withdrawalId = await this._createWithdrawal(db, userId, DIVS_WITHDRAWAL, blockchainId, {
                    user: userId,
                    chain: blockchainId,
                    date: Game.now,
                    deadline,
                    pending: true,
                    amount,
                    nonce,
                    token: 'native',
                    to,
                    currency: 'native'
                });
                let signature = await this._blockchain.getBlockchain(blockchainId).sign(to, withdrawalId, BigInt(amount), nonce, deadline);

                await Game.activityHistory.update(db, { _id: new ObjectId(withdrawalId) }, { signature });

                const state = await db.collection(Collections.DivTokenState)
                    .findOne({ _id: "payouts" });
                const current = this._toBigIntAmount(state.payouts[blockchainId] || 0);

                await db.collection(Collections.DivsWithdrawals)
                    .insertOne({ to, userId, blockchain: blockchainId, amount, availableAmount: current.toString() });

                return {
                    _id: withdrawalId,
                    signature,
                    nonce,
                    deadline,
                    amount
                };
            })
        } catch (exc) {
            console.error(exc)
        } finally {
            await this._lock.release("divs");
        }
    }

    async getPendingTransactions(userId: string, chain: string, tokens: boolean) {
        return Game.activityHistory.getRecords(
            userId,
            {
                chain,
                "data.pending": true,
                type: tokens ? TOKEN_WITHDRAWAL : DIVS_WITHDRAWAL,
                "data.deadline": { $gte: Game.nowSec + WITHDRAWAL_CANCEL_JITTER }
            }
        )
    }

    async _getCancellableTxs(userId: string, type: string, id: string) {
        const records = await Game.activityHistory.getRecords(
            userId,
            {
                type, _id: new ObjectId(id),
                "data.pending": true,
                cancelled: false,
                "data.deadline": { $lt: Game.nowSec + WITHDRAWAL_CANCEL_JITTER }
            }
        );
        if (!records || records.length != 1) {
            throw Errors.NoDividendsWithdrawal;
        }

        return records[0];
    }

    async cancelTokenWithdrawal(userId: string, id: string) {
        const record = await this._getCancellableTxs(userId, TOKEN_WITHDRAWAL, id);
        if (record.cancelled) {
            throw Errors.IncorrectArguments;
        }
        const user = await Game.getUser(userId);

        return Game.dbClient.withTransaction(async db => {
            if (record.type == TOKEN_WITHDRAWAL) {
                await user.inventory.modifyCurrency(record.data.currency, toDecimal(record.data.amount, 6), true);
            }

            await Game.activityHistory.delete(db, new ObjectId(id));

            Game.emitPlayerEvent(record.user, events.TokenWithdrawal, { cancelled: id });
        });
    }

    async cancelDividendsWithdrawal(userId: string, id: string) {
        const record = await this._getCancellableTxs(userId, DIVS_WITHDRAWAL, id);
        if (record.cancelled) {
            throw Errors.IncorrectArguments;
        }

        await Game.activityHistory.delete(Game.db, new ObjectId(id));
        Game.emitPlayerEvent(record.user, events.DivTokenWithdrawal, { cancelled: id });
        return {
            amount: record.data.amount,
            chain: record.chain
        };
    }

    getSupply() {
        return this._supply;
    }

    async getInfo() {
        const payouts = await Game.db.collection(Collections.DivTokenState).findOne({ _id: "payouts" });
        return {
            season: this._season.getStatus(),
            supply: this.getSupply(),
            totalStake: this._totalStake,
            nextPayout: this.getNextPayout(),
            pools: payouts ? payouts.payouts : {}
        }
    }

    async getStatus(userId: string) {
        return {
            ...await this.getInfo(),
            hasHistory: await Game.activityHistory.hasHistory(Game.db, userId),
        };
    }

    private async _createWithdrawal(db: Db, userId: string, type: string, chain: string, data: Withdrawal): Promise<string> {
        const inserted = await Game.activityHistory.save(db, userId, type, chain, data);
        return inserted.insertedId.toHexString();
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
            await Game.dbClient.withTransaction(async db => {
                await this.commitPayoutDay(db);

                this._totalStake = newStake;

                await Game.db.collection(Collections.DivTokenState).updateOne(
                    { _id: this._season.getSeason() },
                    { $set: { stake: this._totalStake } },
                    { upsert: true }
                );

                Game.publishToChannel("divs_info", { totalStake: this._totalStake });
            });
        } finally {
            await this._lock.release("inc_stake");
        }
    }
}
