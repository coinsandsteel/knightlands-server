'use strict';

const { Collections } = require("./../database");
import Game from "./../game";
import PaymentStatus from "../knightlands-shared/payment_status";
const ObjectId = require("mongodb").ObjectID;
const EventEmitter = require('events');

const PaymentErrorCodes = {
    UknownPaymentId: "UknownPaymentId",
    TxSendFailed: "TxSendFailed",
    PaymentFailed: "PaymentFailed"
};

class PaymentProcessor extends EventEmitter {
    constructor(db, blockchain, iapExecutor) {
        super();

        this.PaymentFailed = "payment_failed";
        this.PaymentSent = "payment_sent";

        this._db = db;
        this._blockchain = blockchain;
        this._iapExecutor = iapExecutor;
        this._listeners = {};

        this._blockchain.on(this._blockchain.Payment, this._handleBlockchainPayment.bind(this));
        this._blockchain.on(this._blockchain.PaymentFailed, this._handlePaymentFailed.bind(this));
    }

    registerAsPaymentListener(userId, listener) {
        let listeners = this._getListeners(userId);
        listeners.push(listener);
    }

    unregister(userId, listener) {
        let listeners = this._getListeners(userId);
        let i = 0;
        const length = listeners.length;
        for (; i < length; i++) {
            if (listeners[i] == listener) {
                listeners[i] = listeners[listeners.length - 1];
                listeners.pop();
                break;
            }
        }
    }

    _getListeners(userId) {
        let listeners = this._listeners[userId];
        if (!listeners) {
            listeners = [];
            this._listeners[userId] = listeners;
        }

        return listeners;
    }

    async getPendingPayments(userId, iaps) {
        await this._db.collection(Collections.PaymentRequests).aggregate([
            {
                $match: {
                    userId: userId,
                    claimed: false,
                    status: PaymentStatus.Pending
                }
            },
            {
                $project: {
                    raids: {
                        $filter: {
                            input: "$iap",
                            as: "entry",
                            cond: {
                                $in: ["$$entry", iaps]
                            }
                        }
                    }
                }
            }
        ]).toArray();
    }

    async fetchPaymentStatus(userId, tag, filter = {}) {
        let pendingPayments = await this.fetchPendingPayments(userId, tag, filter);
        if (pendingPayments.length > 0) {
            let payment = pendingPayments[0];
            return {
                "iap": payment.iap,
                "status": payment.status,
                "paymentId": payment._id.valueOf(),
                "price": payment.price,
                "context": payment.context,
                "signature": payment.signature
            };
        }

        return null;
    }

    async fetchPendingPayments(userId, tag, filter = {}) {
        return await this._db.collection(Collections.PaymentRequests).find({
            $and: [{ $or: [{ status: PaymentStatus.Pending }, { status: PaymentStatus.WaitingForTx }] }, {
                userId,
                tag,
                claimed: false
            }, { ...filter }]
        }).toArray();
    }

    async hasPendingRequestByContext(userId, context, tag) {
        let request = await this._db.collection(Collections.PaymentRequests).findOne({
            userId,
            context,
            tag,
            status: PaymentStatus.Pending
        });

        return !!request;
    }

    async requestPayment(userId, iap, tag, context) {
        let fetchPaymentStatus = await this.fetchPaymentStatus(userId, tag, {
            iap,
            context
        });

        if (fetchPaymentStatus) {
            throw "payment already requested";
        }

        let iapObject = await this._db.collection(Collections.IAPs).findOne({
            _id: iap
        });

        if (!iapObject) {
            throw "unknown iap";
        }

        let price = Game.currencyConversionService.convertToNative(iapObject.price);

        let inserted = await this._db.collection(Collections.PaymentRequests).insertOne({
            userId,
            iap,
            tag,
            date: new Date().getTime(),
            status: PaymentStatus.WaitingForTx,
            claimed: false,
            context,
            price
        });

        let paymentId = inserted.insertedId.valueOf() + "";

        // create iap + price + paymentId signed message for smart contract and return it
        let signature = await this._blockchain.sign(iap, paymentId, price);

        await this._db.collection(Collections.PaymentRequests).updateOne({ _id: inserted.insertedId }, {
            $set: {
                signature
            }
        });

        return {
            signature,
            iap,
            price,
            paymentId
        };
    }

    async start() {
        await this._proceedPayments();
        await this._trackPendingPayments();
    }

    async _proceedPayments() {
        console.log("Proceeding unclaimed successfull iaps...");

        // get all unclaimed and finished payments
        let requests = await this._db.collection(Collections.PaymentRequests).find({
            status: PaymentStatus.Success,
            claimed: false
        }).toArray();

        let i = 0;
        const length = requests.length;
        for (; i < length; ++i) {
            let request = requests[i];
            await this._executeIAP(request._id, request.iap, request.context);
        }

        console.log("Proceeding iaps finished.");
    }

    async _trackPendingPayments() {
        console.log("Track pending iaps...");

        // get all unclaimed and finished payments
        let requests = await this._db.collection(Collections.PaymentRequests).find({
            status: PaymentStatus.Pending
        }).toArray();

        let i = 0;
        const length = requests.length;
        for (; i < length; ++i) {
            let request = requests[i];
            await this._blockchain.trackTransactionStatus(request._id, request.userId, request.transactionId);
        }

        console.log("Track pending iaps finished.");
    }

    async acceptPayment(userId, paymentId, signedTransaction) {
        // send tx on behalf of player
        let requestNonce = new ObjectId(paymentId);

        let request = await this._db.collection(Collections.PaymentRequests).findOne({
            _id: requestNonce
        });

        if (!request) {
            throw "unknown payment request";
        }

        if (request.status === PaymentStatus.Pending) {
            throw "already payed";
        }

        try {
            let transactionId = await this._blockchain.sendTransaction(paymentId, userId, signedTransaction);
            if (transactionId) {
                await this._db.collection(Collections.PaymentRequests).updateOne({ _id: requestNonce }, {
                    $set: {
                        transactionId,
                        status: PaymentStatus.Pending
                    }
                });

                this.emit(this.PaymentSent, request.tag, request.context);
            }
        } catch (exc) {
            await this._logError(paymentId, PaymentErrorCodes.TxSendFailed, {
                paymentId: paymentId,
                userId: userId,
                signedTransaction,
                reason: exc
            });

            throw exc;
        }
    }

    async _handleBlockchainPayment(paymentRecipe) {
        // first update status in database
        try {
            let requestNonce = new ObjectId(paymentRecipe.nonce);
            let request = await this._db.collection(Collections.PaymentRequests).findOne({
                _id: requestNonce
            });

            if (!request) {
                await this._logError(paymentRecipe.nonce, PaymentErrorCodes.UknownPaymentId, {
                    paymentId: paymentRecipe.nonce,
                    userId: request.userId,
                    iap: request.iap,
                    timestamp: paymentRecipe.timestamp,
                    tx: request.transactionId
                });
                return;
            }

            if (request.claimed) {
                return;
            }

            await this._db.collection(Collections.PaymentRequests).updateOne({
                _id: requestNonce
            }, {
                $set: {
                    tx: request.transactionId,
                    timestamp: paymentRecipe.timestamp,
                    status: PaymentStatus.Success
                }
            });

            let iapExecuctionResult = await this._executeIAP(request._id, request.iap, request.context);

            let listener = this._getListeners(paymentRecipe.user)[0];
            if (listener) {
                // let listener know that payment arrived
                await listener.onPayment(request.iap, this._iapExecutor.getEventByIAP(request.iap), iapExecuctionResult);
            }
        } catch (exc) {
            console.error(`PaymentProcessor _handleBlockchainPayment failed with exception ${exc}`);
        }
    }

    async _handlePaymentFailed(args) {
        const { transactionId, paymentId, userId } = args;

        let paymentObjectId = new ObjectId(paymentId);

        await this._db.collection(Collections.PaymentRequests).updateOne({
            _id: paymentObjectId
        }, {
            $set: {
                userId,
                tx: transactionId,
                status: PaymentStatus.Failed,
                reason: args.reason
            }
        });

        let payment = await this._db.collection(Collections.PaymentRequests).findOne({
            _id: paymentObjectId
        });

        this.emit(this.PaymentFailed, payment.tag, payment.context);

        let listener = this._getListeners(userId)[0];
        if (listener) {
            console.log("notify client payment failed. Reason: ", JSON.stringify(args.reason, null, 2));

            // let listener know that payment failed
            await listener.onPaymentFailed(payment.iap, this._iapExecutor.getEventByIAP(payment.iap), args.reason, payment.context);
        }
    }

    async _executeIAP(paymentId, iap, context) {
        let executionResponse = await this._iapExecutor.executeIAP(iap, context);

        await this._db.collection(Collections.PaymentRequests).updateOne({
            _id: paymentId
        }, {
            $set: {
                claimed: true
            }
        });

        return executionResponse;
    }

    async _logError(paymentId, errorCode, errorContext) {
        await this._db.collection(Collections.PaymentErrors).replaceOne({ paymentId: paymentId }, {
            errorCode,
            context: errorContext
        }, { upsert: true });
    }
}

module.exports = PaymentProcessor;