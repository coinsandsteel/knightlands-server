'use strict';

const { Collections } = require("./../database");
import PaymentStatus from "./../knightlands-shared/paymentStatus";
const ObjectId = require("mongodb").ObjectID;

class PaymentProcessor {
    constructor(db, blockchainListener, iapExecutor) {
        this._db = db;
        this._blockchainListener = blockchainListener;
        this._iapExecutor = iapExecutor;
        this._listeners = {};

        this._blockchainListener.onEvent("payment", this._handleBlockchainPayment.bind(this));
    }

    registerAsPaymentListener(userId, listener) {
        if (this._listeners[userId]) {
            console.log(`Trying to register already registered listener for user = ${userId}`);
        }

        this._listeners[userId] = listener;
    }

    unregister(userId) {
        delete this._listeners[userId];
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

    async requestPayment(userId, iap, context) {
        let inserted = await this._db.collection(Collections.PaymentRequests).insertOne({
            userId,
            iap,
            date: new Date().getTime(),
            status: PaymentStatus.Pending,
            claimed: false,
            context
        });

        return inserted.insertedId.valueOf();
    }

    async proceedPayments() {
        console.log("Proceeding unclaimed successfull iaps...");

        // get all unclaimed and finished payments
        let requests = await this._db.collection(Collections.PaymentRequests).find({
            status: PaymentStatus.Success,
            claimed: false
        });

        let i = 0;
        const length = requests.length;
        for (; i < length; ++i) {
            await this._iapExecutor.executeIAP(request.api, request.context);
        }

        console.log("Proceeding iaps finished.");
    }

    async _handleBlockchainPayment(paymentRecipe) {
        // first update status in database
        try {
            let requestNonce = new ObjectId(paymentRecipe.nonce);

            let request = await this._db.collection(Collections.PaymentRequests).findOne({
                _id: requestNonce,
                userId: paymentRecipe.user
            });

            await this._iapExecutor.executeIAP(request.api, request.context);

            await this._db.collection(Collections.PaymentRequests).updateOne({
                _id: requestNonce,
                userId: paymentRecipe.user
            }, {
                    $set: {
                        status: paymentRecipe.status,
                        claimed: true
                    }
                });

            let listener = this._listeners[paymentRecipe.user];
            if (listener) {
                // let listener know that payment arrived
                await listener.onPayment(paymentRecipe.status, paymentRecipe.iap);
            }
        } catch (exc) {
            console.error(`PaymentProcessor _handleBlockchainPayment failed with exception ${exc}`);
        }

    }
}

module.exports = PaymentProcessor;