const IBlockchainListener = require("../IBlockchainListener");
const IBlockchainSigner = require("../IBlockchainSigner");
const ClassAggregation = require("../../classAggregation");
const TronWeb = require("tronweb");
const web3utls = require('web3-utils');

const { Collections } = require("../../database");

const PaymentGateway = require("./PaymentGateway.json");
const Dividends = require("./Dividends.json");
const PresaleChestGateway = require("./PresaleChestGateway.json");
const Presale = require("./Presale.json");
const DKT = require("./DKT.json");

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
        this.TransactionFailed = "TransactionFailed";
        this.DividendTokenWithdrawal = "DividendTokenWithdrawal";

        this._eventsReceived = 0;

        this._eventWatchers = {};

        this._db = db;
        this._tronWeb = new TronWeb({
            fullHost: (process.env.ENV || 'dev') == 'prod' ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io',
            privateKey: "b7b1a157b3eef94f74d40be600709b6aeb538d6d8d637f49025f4c846bd18200"
        });

        // load payment contract
        this._paymentContract = this._tronWeb.contract(PaymentGateway.abi, PaymentGateway.address);
        this._presale = this._tronWeb.contract(Presale.abi, Presale.address);
        this._presaleChestsGateway = this._tronWeb.contract(PresaleChestGateway.abi, PresaleChestGateway.address);
        this._dividends = this._tronWeb.contract(Dividends.abi, Dividends.address);
        this._stakingToken = this._tronWeb.contract(DKT.abi, DKT.address);
    }

    get PaymentGatewayAddress() {
        return PaymentGateway.address;
    }

    get DividendTokenAddress() {
        return DKT.address;
    }

    async _watchNewBlocks() {
        let lastBlockInfo = await this._tronWeb.trx.getCurrentBlock();
        await this._updateLastScanTimestamp(lastBlockInfo.block_header.raw_data.number);

        setTimeout(this._watchNewBlocks.bind(this), NewBlockScanInterval);
    }

    isAddress(addr) {
        return addr != "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    }

    _watchEvent(eventName, contactAddress , handler) {
        this._eventWatchers = setTimeout(this._scanEventsFor.bind(this, eventName, contactAddress , handler), 3000);
    }

    async _scanEventsFor(eventName, contactAddress, handler) {
        try {
            let eventsScanned = await this._db.collection(Collections.Services).findOne({
                type: EventsScanned,
                event: eventName
            });
    
            let scaneStartTimestamp = (eventsScanned || {}).lastScan || false;
            let lastScanTimestamp = scaneStartTimestamp;
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
                    handler.call(this, eventData.transaction, eventData.timestamp, eventData.result);
                }
    
                options.page++;
                options.fingerPrint = events[length - 1]._fingerPrint;
    
                if (!options.fingerPrint) {
                    break;
                }
            }
    
            if (scaneStartTimestamp != lastScanTimestamp) {
                await this._updateLastEventReceived(lastScanTimestamp, eventName);
            }
        } finally {
            this._watchEvent(eventName, contactAddress, handler);
        }
    }

    async _scanEvents() {
        console.log("Scanning missed events...");

        this._watchEvent("Purchase", PaymentGateway.address, this._emitPayment);
        this._watchEvent("ChestReceived", PresaleChestGateway.address, this._emitPresaleChestsTransfer);
        this._watchEvent("ChestPurchased", Presale.address, this._emitPresaleChestPurchase);
        this._watchEvent("Transfer", DKT.address, this._emitWithdrawal);

        console.log("Scan finished.");
    }

    async start() {
        await this._scanEvents();
    }

    async _updateLastEventReceived(time, eventName) {
        await this._db.collection(Collections.Services).updateOne({ type: EventsScanned, event: eventName }, { $set: { lastScan: time + 1 } }, { upsert: true });
    }

    _emitPresaleChestsTransfer(transaction, timestamp, eventData) {
        this.emit(this.PresaleChestTransfer, {
            tx: transaction,
            timestamp: timestamp / 1000,
            user: this._tronWeb.address.fromHex(eventData.from),
            chestId: eventData.chestId,
            amount: eventData.amount
        });
    }

    _emitPresaleChestPurchase(transaction, timestamp, eventData) {
        this.emit(this.PresaleChestPurchased, {
            tx: transaction,
            timestamp: timestamp / 1000,
            user: this._tronWeb.address.fromHex(eventData.purchaser),
            referer: this._tronWeb.address.fromHex(eventData.referer),
            chestId: eventData.chest,
            amount: eventData.amount
        });
    }

    _emitPayment(transaction, timestamp, eventData) {
        this.emit(this.Payment, {
            success: true,
            nonce: eventData.paymentId,
            timestamp: timestamp / 1000
        });
    }

    _emitWithdrawal(transaction, timestamp, eventData) {
        if (eventData.from == "0x0000000000000000000000000000000000000000") {
            this.emit(this.DividendTokenWithdrawal, {
                success: true,
                to: this._tronWeb.address.fromHex(eventData.to),
                amount: eventData.value,
                timestamp: timestamp / 1000,
                tx: transaction
            });
        }
    }

    _emitTransactionFailed(contractAddress, transaction, payload, userId, reason) {
        this.emit(this.TransactionFailed, {
            transactionId: transaction,
            payload,
            userId,
            reason,
            contractAddress
        });
    }

    addressForSigning(address) {
        // https://github.com/TRON-US/tronweb/blob/master/src/utils/abi.js
        return this._tronWeb.address.toHex(address).replace(/^(41)/, '');
    }

    async verifySign(nonce, message, address) {
        await this._ensureConnected();
        try {
            return await this._tronWeb.trx.verifyMessage(this._tronWeb.toHex(nonce), message, address);
        } catch (_) {
            return false;
        }
    }

    _isHex(string) {
        return (typeof string === 'string'
            && !isNaN(parseInt(string, 16))
            && /^(0x|)[a-fA-F0-9]+$/.test(string));
    }

    async sign(...args) {
        args.forEach(arg => {
            if (this._isHex(arg)) {
                // assume that hex is address until other hex values will be used
                arg = web3utls.toChecksumAddress(arg);
            }

            params.push(arg);
        });

        return await this._tronWeb.trx.sign(web3utls.soliditySha3(...params));
    }

    async sendTransaction(contractAddress, payload, userId, signedTransaction) {
        const broadCastResponse = await this._tronWeb.trx.sendRawTransaction(signedTransaction);

        if (broadCastResponse.code) {
            let reason;

            if (broadCastResponse.message) {
                reason = this._tronWeb.toUtf8(broadCastResponse.message);
            }

            this._emitTransactionFailed(contractAddress, signedTransaction.txID, payload, userId, reason);
            return;
        }

        this._trackTransactionFailure(contractAddress, payload, userId, signedTransaction.txID);

        return signedTransaction.txID;
    }

    async trackTransactionStatus(contractAddress, payload, userId, transactionId) {
        this._trackTransactionFailure(contractAddress, payload, userId, transactionId, true);
    }

    // track failure, success will be tracked using events
    async _trackTransactionFailure(contractAddress, payload, userId, txID, emitSuccess = false) {
        const output = await this._tronWeb.trx.getTransactionInfo(txID);

        if (!Object.keys(output).length) {
            return setTimeout(() => {
                this._trackTransactionFailure(contractAddress, payload, userId, txID, emitSuccess);
            }, TxFailureScanInterval);
        }

        if ((output.result && output.result == "FAILED") || !output.hasOwnProperty("contractResult")) {
            // return callback({
            //     error: this.tronWeb.toUtf8(output.resMessage),
            //     transaction: signedTransaction,
            //     output
            // });
            console.log("TX failed", contractAddress, JSON.stringify(output));
            this._emitTransactionFailed(contractAddress, txID, payload, userId, output.result);
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

    async getPaymentNonce(walletAddress) {
        const result =  await this._paymentContract.methods.nonces(walletAddress).call();
        return result.valueOf();
    }

    async getDividendTokenNonce(walletAddress) {
        const result =  await this._stakingToken.methods.nonces(walletAddress).call();
        return result.valueOf();
    }
}

module.exports = TronBlockchain;