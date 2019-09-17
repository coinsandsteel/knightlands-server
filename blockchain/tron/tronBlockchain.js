const IBlockchainListener = require("../IBlockchainListener");
const IBlockchainSigner = require("../IBlockchainSigner");
const ClassAggregation = require("../../classAggregation");
const TronWeb = require("tronweb");

const { Collections } = require("../../database");

const PaymentGateway = require("./PaymentGateway.json");
const PresaleChestGateway = require("./PresaleChestGateway.json");
const Presale = require("./Presale.json");

const NewBlockScanInterval = 10000;
const TxFailureScanInterval = 5000;

function hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(`0x${hex.substr(c, 2)}`);
    return bytes;
}

const EventsPageSize = 50;
const EventsScanned = "eventsScanned";

class TronBlockchain extends ClassAggregation(IBlockchainListener, IBlockchainSigner) {
    constructor(db) {
        super(db);

        this.Payment = "Purchase";
        this.PaymentFailed = "PurchaseFailed";
        this.PresaleChestTransfer = "PresaleChestTransfer";
        this.PresaleChestPurchased = "PresaleChestPurchased";

        this._eventsReceived = 0;

        this._eventWatchers = {};

        this._db = db;
        this._tronWeb = new TronWeb({
            fullHost: (process.env.ENV || 'dev') == 'prod' ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io',
            privateKey: "b7b1a157b3eef94f74d40be600709b6aeb538d6d8d637f49025f4c846bd18200"
        });

        // load payment contract
        this._paymentContract = this._tronWeb.contract(PaymentGateway.abi, PaymentGateway.address);
        this._paymentContract.Purchase().watch((err, eventData) => {
            if (!err) {
                // this._updateLastEventReceived(eventData.timestamp, "Purchase");
                this._emitPayment(eventData.result.paymentId, eventData.transaction, eventData.timestamp, eventData.result.from);
            }
        });

        this._presale = this._tronWeb.contract(Presale.abi, Presale.address);
        this._presale.ChestPurchased().watch((err, eventData) => {
            if (!err) {
                // this._updateLastEventReceived(eventData.timestamp, "ChestPurchased");
                this._emitPresaleChestPurchase(eventData.result, eventData.transaction, eventData.timestamp);
            }
        });

        this._presaleChestsGateway = this._tronWeb.contract(PresaleChestGateway.abi, PresaleChestGateway.address);
        this._presaleChestsGateway.ChestReceived().watch((err, eventData) => {
            if (!err) {
                // this._updateLastEventReceived(eventData.timestamp, "ChestReceived");
                this._emitPresaleChestsTransfer(eventData.result, eventData.transaction, eventData.timestamp);
            }
        });
    }

    async _watchNewBlocks() {
        let lastBlockInfo = await this._tronWeb.trx.getCurrentBlock();
        await this._updateLastScanTimestamp(lastBlockInfo.block_header.raw_data.number);

        setTimeout(() => {
            this._watchNewBlocks();
        }, NewBlockScanInterval);
    }

    isAddress(addr) {
        return addr != "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    }

    _watchEvent(eventName, contactAddress , handler) {
        this._eventWatchers = setTimeout(this._scanEventsFor.bind(this, eventName, contactAddress , handler), 3000);
    }

    async _scanEventsFor(eventName, contactAddress, handler) {
        let eventsScanned = await this._db.collection(Collections.Services).findOne({
            type: EventsScanned,
            event: eventName
        });

        let lastScanTimestamp = (eventsScanned || {}).lastScan || false;
        let options = {
            eventName: eventName,
            sort: "block_timestamp", // force to work since as intended - make a minimum point of time to scan events
            onlyConfirmed: true,
            size: EventsPageSize,
            fromTimestamp: lastScanTimestamp,
            page: 1
        };

        // get block 1 by 1 and search for events
        while (true) {
            let events = await this._tronWeb.getEventResult(contactAddress, options);
            const length = events.length;

            if (length == 0) {
                break;
            }

            let i = 0;
            for (; i < length; i++) {
                let eventData = events[i];
                lastScanTimestamp = eventData.timestamp;
                handler.call(this, eventData.result, eventData.transaction, eventData.timestamp);
            }

            options.page++;
            options.fingerPrint = events[length - 1]._fingerPrint;

            if (!options.fingerPrint) {
                break;
            }
        }

        if (lastScanTimestamp) {
            await this._updateLastEventReceived(lastScanTimestamp, eventName);
        }

        this._watchEvent(eventName, contactAddress, handler);
    }

    async _scanEvents() {
        console.log("Scanning missed events...");

        this._watchEvent("Purchase", PaymentGateway.address, this._emitPayment);
        this._watchEvent("ChestReceived", PresaleChestGateway.address, this._emitPresaleChestsTransfer);
        this._watchEvent("ChestPurchased", Presale.address, this._emitPresaleChestPurchase);

        console.log("Scan finished.");
    }

    async start() {
        await this._scanEvents();
    }

    async _updateLastEventReceived(time, eventName) {
        await this._db.collection(Collections.Services).updateOne({ type: EventsScanned, event: eventName }, { $set: { lastScan: time + 1 } }, { upsert: true });
    }

    _emitPresaleChestsTransfer(eventData, transaction, timestamp) {
        this.emit(this.PresaleChestTransfer, {
            tx: transaction,
            timestamp: timestamp / 1000,
            user: this._tronWeb.address.fromHex(eventData.from),
            chestId: eventData.chestId,
            amount: eventData.amount
        });
    }

    _emitPresaleChestPurchase(eventData, transaction, timestamp) {
        this.emit(this.PresaleChestPurchased, {
            tx: transaction,
            timestamp: timestamp / 1000,
            user: this._tronWeb.address.fromHex(eventData.purchaser),
            referer: this._tronWeb.address.fromHex(eventData.referer),
            chestId: eventData.chest,
            amount: eventData.amount
        });
    }

    _emitPayment(paymentId, transaction, timestamp, from, err) {
        from = this._tronWeb.address.fromHex(from);

        if (err) {
            this._emitPaymentFailed(transaction, paymentId, from);
        } else {
            this.emit(this.Payment, {
                success: true,
                error: err,
                nonce: paymentId,
                tx: transaction,
                timestamp: timestamp / 1000,
                user: this._tronWeb.address.fromHex(from)
            });
        }
    }

    _emitPaymentFailed(transaction, paymentId, userId, reason) {
        this.emit(this.PaymentFailed, {
            transactionId: transaction,
            paymentId,
            userId,
            reason
        });
    }

    async verifySign(nonce, message, address) {
        await this._ensureConnected();
        try {
            return await this._tronWeb.trx.verifyMessage(this._tronWeb.toHex(nonce), message, address);
        } catch (_) {
            return false;
        }
    }

    async sign(...args) {
        let encoded = "";
        args.forEach(arg => {
            let hex = this._tronWeb.toHex(arg).substr(2);
            if (typeof arg === 'number') {
                // pad with 0
                hex = hex.padStart(64, "0");
            }

            encoded += hex;
        });

        let result = hexToBytes(encoded);
        let hash = this._tronWeb.sha3(result);

        return await this._tronWeb.trx.sign(hash);
    }

    async sendTransaction(paymentId, userId, signedTransaction) {
        const broadCastResponse = await this._tronWeb.trx.sendRawTransaction(signedTransaction);

        if (broadCastResponse.code) {
            let reason;

            if (broadCastResponse.message) {
                reason = this._tronWeb.toUtf8(broadCastResponse.message);
            }

            this._emitPaymentFailed(signedTransaction.txID, paymentId, userId, reason);
            return;
        }

        this._trackTransactionFailure(paymentId, userId, signedTransaction.txID);

        return signedTransaction.txID;
    }

    async trackTransactionStatus(paymentId, userId, transactionId) {
        this._trackTransactionFailure(paymentId, userId, transactionId, true);
    }

    // track failure, success will be tracked using events
    async _trackTransactionFailure(paymentId, userId, txID, emitSuccess = false) {
        const output = await this._tronWeb.trx.getTransactionInfo(txID);

        if (!Object.keys(output).length) {
            return setTimeout(() => {
                this._trackTransactionFailure(paymentId, userId, txID, emitSuccess);
            }, TxFailureScanInterval);
        }

        if ((output.result && output.result == "FAILED") || !output.hasOwnProperty("contractResult")) {
            // return callback({
            //     error: this.tronWeb.toUtf8(output.resMessage),
            //     transaction: signedTransaction,
            //     output
            // });
            this._emitPaymentFailed(txID, paymentId, userId);
        }

        if (emitSuccess) {
            // this._emitPayment(paymentId, txID, );
        }

        // return callback({
        //     error: 'Failed to execute: ' + JSON.stringify(output, null, 2),
        //     transaction: txID,
        //     output
        // });
    }

    async _ensureConnected() {
        await this._tronWeb.isConnected();
    }
}

module.exports = TronBlockchain;