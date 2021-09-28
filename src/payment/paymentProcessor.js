'use strict';

const { Collections } = require("../database/database");
import Game from "../game";
import PaymentStatus from "../knightlands-shared/payment_status";
import Errors from "../knightlands-shared/errors";
import { ObjectId } from "mongodb";
import blockchains from "../knightlands-shared/blockchains";
import { Blockchain } from "./../blockchain/Blockchain";
const EventEmitter = require('events');
const Config = require("../config");

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

        this._blockchain.on(Blockchain.Payment, this._handleBlockchainPayment.bind(this));
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
        userId = userId.toString();
        let listeners = this._listeners[userId];
        if (!listeners) {
            listeners = [];
            this._listeners[userId] = listeners;
        }

        return listeners;
    }

    async getPendingPayments(userId, iaps) {
        await this._db.collection(Collections.PaymentRequests).aggregate([{
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
                "paymentId": payment._id.toHexString(),
                "price": payment.price,
                "nonce": payment.nonce,
                "deadline": payment.deadline,
                "context": payment.context,
                "signature": payment.signature,
                "id": payment._id,
                "chain": payment.chain
            };
        }

        return null;
    }

    async cancelPayment(userId, id) {
        const idObject = new ObjectId(id);

        const payment = await this._db.collection(Collections.PaymentRequests).findOne({
            $and: [{
                    userId,
                    _id: idObject,
                },
                {
                    $or: [{ status: PaymentStatus.Pending }, { status: PaymentStatus.WaitingForTx }]
                }
            ]
        });

        if (!payment) {
            throw Errors.UknownPaymentId;
        }

        await this._db.collection(Collections.PaymentRequests).updateOne({ _id: idObject }, {
            $set: {
                status: PaymentStatus.Cancelled
            }
        });
    }

    async fetchPendingPayments(userId, tag, filter = {}) {
        let query = {
            $and: [{ $or: [{ status: PaymentStatus.Pending }, { status: PaymentStatus.WaitingForTx }] }, {
                    userId,
                    tag,
                    claimed: false
                },
                {...filter },
                { deadline: { $gte: Game.nowSec } }
            ]
        };
        return await this._db.collection(Collections.PaymentRequests).find(query).toArray();
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

    async requestPayment(userId, iap, tag, context, address, chain) {
        if (!iap) {
            throw Errors.UnknownIap;
        }

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

        return Game.dbClient.withTransaction(async db => {
            const chainClient = this._blockchain.getBlockchain(chain);
            const nonce = Number(await chainClient.getPaymentNonce(address));
            // price is in cents
            let price = Game.currencyConversionService.convertToNative(chainClient.getNativeCurrency(), iapObject.price);
            price = chainClient.getBigIntNativeAmount(price);
            let deadline = Game.nowSec + 600;

            let inserted = await db.collection(Collections.PaymentRequests).insertOne({
                userId,
                iap,
                tag,
                date: Game.now,
                status: PaymentStatus.WaitingForTx,
                claimed: false,
                context,
                price: price.toString(),
                nonce,
                deadline,
                chain
            });

            let paymentId = inserted.insertedId.toHexString();
            const gateway = chainClient.PaymentGatewayAddress;

            // create signature for the smart contract and return it
            let signature = await chainClient.sign(gateway, iap, paymentId, price, nonce, deadline);

            await db.collection(Collections.PaymentRequests).updateOne({ _id: inserted.insertedId }, {
                $set: {
                    signature
                }
            });

            return {
                signature,
                iap,
                price: price.toString(),
                nonce,
                deadline,
                paymentId
            };
        })
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
            await this._blockchain.getBlockchain(blockchains.Tron).trackTransactionStatus(this._blockchain.getBlockchain(blockchains.Tron).PaymentGatewayAddress, request._id, request.userId, request.transactionId);
        }

        console.log("Track pending iaps finished.");
    }

    async _handleBlockchainPayment(id, paymentRecipe) {
        console.log('handle payment', id, paymentRecipe)
            // first update status in database
        try {
            let requestNonce = new ObjectId(paymentRecipe.paymentId);
            let request = await this._db.collection(Collections.PaymentRequests).findOne({
                _id: requestNonce,
                chain: id
            });

            if (!request) {
                await this._logError(paymentRecipe.paymentId, PaymentErrorCodes.UknownPaymentId, {
                    paymentId: paymentRecipe.paymentId,
                    paymentRecipe: paymentRecipe
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
                    transactionHash: paymentRecipe.transactionHash,
                    block: paymentRecipe.blockNumber,
                    status: PaymentStatus.Success
                }
            });

            let iapExecuctionResult = await this._executeIAP(request._id, request.iap, request.context);
            let listener = this._getListeners(request.userId)[0];

            if (listener) {
                // let listener know that payment arrived
                await listener.onPayment(request.iap, this._iapExecutor.getEventByIAP(request.iap), iapExecuctionResult);
            }
        } catch (exc) {
            console.error(`PaymentProcessor _handleBlockchainPayment failed with exception ${exc}`);
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