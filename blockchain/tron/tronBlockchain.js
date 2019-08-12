const IBlockchainListener = require("../IBlockchainListener");
const IBlockchainSigner = require("../IBlockchainSigner");
const ClassAggregation = require("../../classAggregation");
const TronWeb = require("tronweb");

const { Collections } = require("../../database");

const PaymentGateway = require("./PaymentGateway.json");

const NewBlockScanInterval = 10000;
const TxFailureScanInterval = 5000;

function hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(`0x${hex.substr(c, 2)}`);
    return bytes;
}

class TronBlockchain extends ClassAggregation(IBlockchainListener, IBlockchainSigner) {
    constructor(db) {
        super(db);

        this.Payment = "Purchase";
        this.PaymentFailed = "PurchaseFailed";

        this._db = db;
        this._tronWeb = new TronWeb({
            fullHost: (process.env.ENV || 'dev') == 'dev' ? 'https://api.shasta.trongrid.io' : 'https://api.trongrid.io',
            privateKey: 'b7b1a157b3eef94f74d40be600709b6aeb538d6d8d637f49025f4c846bd18200'
        });

        // load payment contract
        this._paymentContract = this._tronWeb.contract(PaymentGateway.abi, PaymentGateway.address);
        this._paymentContract.Purchase().watch((err, eventData) => {
            // save as previous block number just to make sure in case of failure we will rescan same block for possibly missed events
            if (!err) {
                this._updateLastScanTimestamp(eventData.block - 1);
                this._emitPayment(eventData.result.paymentId, eventData.transaction, eventData.timestamp, eventData.result.from);
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

    async scanEvents() {
        console.log("Scanning missed events...");

        let lastScan = await this._db.collection(Collections.Services).findOne({
            _id: "lastScan"
        });

        let startBlock = 0;
        let lastBlockInfo = await this._tronWeb.trx.getCurrentBlock();
        let lastBlock = lastBlockInfo.block_header.raw_data.number;

        if (lastScan) {
            startBlock = lastScan.block - 20;
        }

        // very first scan, get all events
        if (startBlock == 0) {
            lastBlock = 0;
        }

        let options = {
            eventName: this.Payment,
            onlyConfirmed: true,
        };

        let blocksToScan = lastBlock - startBlock + 1;
        let blocksScanned = 0;

        // get block 1 by 1 and search for events
        for (; startBlock <= lastBlock; startBlock++) {
            if (startBlock > 0) {
                options.blockNumber = startBlock;
            }

            let events = await this._tronWeb.getEventResult(PaymentGateway.address, options);

            let i = 0;
            const length = events.length;
            for (; i < length; i++) {
                let eventData = events[i];
                console.log("Scanned event", eventData);
                this._emitPayment(eventData.result.paymentId, eventData.transaction, eventData.timestamp, eventData.result.from);
            }

            await this._updateLastScanTimestamp(startBlock);

            blocksScanned++;
            console.log(`Scanned blocks ${blocksScanned}/${blocksToScan}`);
        }

        await this._updateLastScanTimestamp(lastBlockInfo.block_header.raw_data.number);

        this._watchNewBlocks();

        console.log("Scanning missed is done.");
    }

    async _updateLastScanTimestamp(block) {
        await this._db.collection(Collections.Services).replaceOne({ _id: "lastScan", }, { block: block }, { upsert: true });
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
                user: from
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
        return await this._tronWeb.trx.verifyMessage(this._tronWeb.toHex(nonce), message, address);
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