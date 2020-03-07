import Game from "./../game";
import CurrencyType from "../knightlands-shared/currency_type";
import Errors from "../knightlands-shared/errors";
const { Collections } = require("../database");

const DividendsOperations = {
    WithdrawToken: "withdraw_token"
};

const WithdrawalStatus = {
    Pending: "pending",
    Failed: "failed",
    Success: "success"
};

class Dividends {
    constructor(db, blockchain) {
        this._db = db;
        this._blockchain = blockchain;
    }

    async requestTokenWithdrawal(user, amount) {
        if (amount <= 0 || amount > this._inventory.getCurrency(CurrencyType.Dkt)) {
            throw Errors.NotEnoughCurrency;
        }

        // generate signature 
        const nonce = Number(await this._blockchain.getDividendTokenNonce(this._user.address));
        const signature = await this._blockchain.sign(this._user.address, amount, nonce);

        const inserted = await this._db.collection(Collections.DivTokenRequests).insertOne({
            user: this._user.address,
            timestamp: Game.nowSec,
            operation: DividendsOperations.WithdrawToken,
            status: WithdrawalStatus.Pending,
            amount,
            nonce,
            signature
        });

        return { nonce, signature };
    }

    async acceptTransaction(requestId, signedTransaction) {

    }

    async init() {
        console.log("Track pending withdrawals...");

        // get all unclaimed and finished payments
        let requests = await this._db.collection(Collections.DivTokenRequests).find({
            status: WithdrawalStatus.Pending
        }).toArray();

        let i = 0;
        const length = requests.length;
        for (; i < length; ++i) {
            let request = requests[i];
            await this._blockchain.trackTransactionStatus(request._id, request.userId, request.transactionId);
        }

        console.log("Track pending iaps finished.");
    }
}

module.exports = Dividends;