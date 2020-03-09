import Game from "./../game";
import CurrencyType from "../knightlands-shared/currency_type";
import Errors from "../knightlands-shared/errors";
const { Collections } = require("../database");
import TransactionStatus from "./../knightlands-shared/payment_status";

class Dividends {
    constructor(db, blockchain) {
        this._db = db;
        this._blockchain = blockchain;

        this._blockchain.on(this._blockchain.DividendTokenWithdrawal, this._handleWithdrawal.bind(this));
        this._blockchain.on(this._blockchain.TransactionFailed, this._handleWithdrawalFailed.bind(this));
    }

    async init() {
        console.log("Track pending dividend token withdrawals...");

        // get all unclaimed and finished payments
        let requests = await this._db.collection(Collections.DivTokenWithdrawals).find({
            status: TransactionStatus.WaitingForTx
        }).toArray();

        let i = 0;
        const length = requests.length;
        for (; i < length; ++i) {
            let request = requests[i];
            await this._blockchain.trackTransactionStatus(this._blockchain.DividendTokenAddress, request.amount, request.userId, request.transactionId);
        }

        console.log("Track pending withdrawals finished.");
    }

    async requestTokenWithdrawal(user, amount) {
        const inventory = user.inventory;

        if (amount <= 0 || amount > inventory.getCurrency(CurrencyType.Dkt)) {
            throw Errors.NotEnoughCurrency;
        }

        const address = user.address;

        // if there is pending withdrawal - return
        const pendingWithdrawal = await this.getPendingWithdrawal(address);
        if (pendingWithdrawal) {
            throw Errors.DividendsWithdrawalPending;
        }

        // generate signature 
        const nonce = Number(await this._blockchain.getDividendTokenNonce(address));
        const signature = await this._blockchain.sign(this._blockchain.addressForSigning(address), amount, nonce);

        await this._db.collection(Collections.DivTokenWithdrawals).insertOne({
            userId: address,
            request_timestamp: Game.nowSec,
            status: TransactionStatus.WaitingForTx,
            amount,
            nonce,
            signature
        });

        await inventory.modifyCurrency(CurrencyType.Dkt, -amount);

        return { nonce, signature, amount };
    }

    async getPendingWithdrawal(address) {
        return await this._db.collection(Collections.DivTokenWithdrawals).findOne({ userId: address, status: TransactionStatus.WaitingForTx });
    }

    async acceptTransaction(userId, signedTransaction) {
        // guaranteed to have only 1 running withdrawal per user
        let request = await this._db.collection(Collections.DivTokenWithdrawals).findOne({
            userId,
            status: TransactionStatus.WaitingForTx
        });

        if (!request) {
            throw Errors.NoDividendsWithdrawal;
        }

        try {
            let transactionId = await this._blockchain.sendTransaction(this._blockchain.DividendTokenAddress, request.amount, userId, signedTransaction);
            if (transactionId) {
                await this._db.collection(Collections.DivTokenWithdrawals).updateOne({ _id: request._id }, {
                    $set: {
                        transactionId,
                        status: TransactionStatus.Pending
                    }
                });
            }
        } catch (exc) {
            await this._db.collection(Collections.DivTokenWithdrawals).updateOne({ userId }, {
                $set: {
                    status: TransactionStatus.Failed
                }
            });

            let controller = Game.getPlayerController(userId);
            if (controller) {
                await controller.onDividendTokenWithdrawal(false);
            }

            throw exc;
        }
    }

    async _handleWithdrawalFailed(payload) {
        if (payload.contractAddress != this._blockchain.DividendTokenAddress) {
            return;
        }

        await this._db.collection(Collections.DivTokenWithdrawals).updateOne({ transactionId: payload.transactionId }, {
            $set: {
                status: TransactionStatus.Failed
            }
        });

        // refund DKT
        const inventory = await Game.loadInventory(payload.userId);
        if (inventory) {
            await inventory.autoCommitChanges(async inv=>{
                await inv.modifyCurrency(CurrencyType.Dkt, payload.payload);
            });
        }

        let controller = Game.getPlayerController(payload.userId);
        if (controller) {
            await controller.onDividendTokenWithdrawal(false);
        }
    }

    async _handleWithdrawal(payload) {
        await this._db.collection(Collections.DivTokenWithdrawals).updateOne({ transactionId: payload.tx }, {
            $set: {
                timestamp: payload.timestamp,
                status: TransactionStatus.Success
            }
        });

        // notify user about successfull withdrawal
        let controller = Game.getPlayerController(payload.to);
        if (controller) {
            await controller.onDividendTokenWithdrawal(true, payload.amount);
        }
    }
}

module.exports = Dividends;