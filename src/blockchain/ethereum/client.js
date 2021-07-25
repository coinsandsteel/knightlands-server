const IBlockchainListener = require("../IBlockchainListener");
const IBlockchainSigner = require("../IBlockchainSigner");
const ClassAggregation = require("../../classAggregation");
const { ethers } = require("ethers");

const { Collections } = require("../../database");

const PaymentGateway = require("./PaymentGateway.json");
// const PresaleChestGateway = require("./PresaleChestGateway.json");
// const Presale = require("./Presale.json");
const Flesh = require("./Flesh.json");
import blockchains from "../../knightlands-shared/blockchains";
import { Blockchain } from "../Blockchain";

const NewBlockScanInterval = 15000;
const TxFailureScanInterval = 5000;

function hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(`0x${hex.substr(c, 2)}`);
    return bytes;
}

const FirstBlockToScan = 5197870
const Confirmations = 1;
const BlocksRange = 500;
const EventsScanned = "eventsScanned";

class EthereumBlockchain extends ClassAggregation(IBlockchainListener, IBlockchainSigner) {
    constructor(db) {
        super(db);

        this.Payment = Blockchain.Payment;
        this.PresaleChestTransfer = "PresaleChestTransfer";
        this.PresaleChestPurchased = "PresaleChestPurchased";
        this.TransactionFailed = Blockchain.TransactionFailed;
        this.DividendTokenWithdrawal = Blockchain.DividendTokenWithdrawal;
        this.DividendWithdrawal = Blockchain.DividendWithdrawal;
        this.TokenWithdrawal = Blockchain.TokenWithdrawal;

        this._eventsReceived = 0;
        this._eventWatchers = {};
        this._db = db;

        this._provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_URL || "http://127.0.0.1:8545");
        this._signer = new ethers.Wallet(process.env.PK, this._provider);

        this._paymentContract = new ethers.Contract(PaymentGateway.address, PaymentGateway.abi, this._provider);
        // this._presale = this._provider.contract(Presale.abi, Presale.address);
        // this._presaleChestsGateway = this._provider.contract(PresaleChestGateway.abi, PresaleChestGateway.address);
        // this._dividends = this._provider.contract(Dividends.abi, Dividends.address);
        this._stakingToken = new ethers.Contract(Flesh.address, Flesh.abi, this._provider);
    }

    get PaymentGatewayAddress() {
        return PaymentGateway.address;
    }

    get DividendTokenAddress() {
        return Flesh.address;
    }

    getBigIntDivTokenAmount(amount) {
        // with 6 decimals and known inflation rate, this is safe conversion
        return BigInt(Math.floor(amount * Math.pow(10, 6)).toString());
    }

    getNumberDivTokenAmount(bigInt) {
        const str = bigInt.toString();
        let decimal = "0";
        if (str != "0") {
            decimal = str.slice(0, str.length-6) + "." + str.slice(str.length-6);
        }
        return Number(decimal);
    }

    async _watchNewBlocks() {
        let blockNumber = await this._provider.getBlockNumber()
        await this._updateLastScanTimestamp(blockNumber);

        setTimeout(this._watchNewBlocks.bind(this), NewBlockScanInterval);
    }

    isAddress(addr) {
        return ethers.utils.isAddress(addr)
    }

    _watchEvent(eventName, eventFilter, contract , handler) {
        this._eventWatchers = setTimeout(this._scanEventsFor.bind(this, eventName, eventFilter, contract , handler), 3000);
    }

    async _scanEventsFor(eventName, eventFilter, contract, handler) {
        try {
            let eventsScanned = await this._db.collection(Collections.Services).findOne({
                chain: blockchains.Ethereum,
                type: EventsScanned,
                event: eventName
            });

            const lastBlock = (await this._provider.getBlockNumber()) - Confirmations;

            let startBlock = (eventsScanned || {}).lastScan || FirstBlockToScan;
            let endBlock = startBlock + BlocksRange;
            if (endBlock > lastBlock) {
                endBlock = lastBlock;
            }
    
            // get block 1 by 1 and search for events
            while (endBlock >= startBlock) {
                let events = await contract.queryFilter(eventFilter, startBlock, endBlock)
                const length = events.length;
                if (length == 0) {
                    break;
                }
    
                let i = 0;
                for (; i < length; i++) {
                    handler.call(this, events[i]);
                }

                startBlock = endBlock + 1;
                endBlock = startBlock + BlocksRange;

                if (endBlock > lastBlock) {
                    endBlock = lastBlock;
                }
            }
    
            await this._updateLastEventReceived(endBlock, eventName);
        } finally {
            this._watchEvent(eventName, eventFilter, contract, handler);
        }
    }

    async _scanEvents() {
        console.log("Scanning missed events..."); 

        this._watchEvent("Purchase", this._paymentContract.filters.Purchase(), this._paymentContract, this._emitPayment);
        this._watchEvent("Withdrawal", this._paymentContract.filters.Withdrawal(), this._paymentContract, this._emitDivsWithdrawal);
        // this._watchEvent("ChestReceived", PresaleChestGateway.address, this._emitPresaleChestsTransfer);
        // this._watchEvent("ChestPurchased", Presale.address, this._emitPresaleChestPurchase);
        // this._watchEvent("Transfer", this._stakingToken, this._emitWithdrawal);

        console.log("Scan finished.");
    }

    async start() {
        await this._scanEvents();
    }

    async _updateLastEventReceived(blockNumber, eventName) {
        await this._db.collection(Collections.Services).updateOne({ type: EventsScanned, event: eventName, chain: blockchains.Ethereum }, { $set: { lastScan: blockNumber + 1 } }, { upsert: true });
    }

    _emitPresaleChestsTransfer(transaction, timestamp, eventData) {
        this.emit(this.PresaleChestTransfer, {
            tx: transaction,
            timestamp: timestamp / 1000,
            user: this._provider.address.fromHex(eventData.from),
            chestId: eventData.chestId,
            amount: eventData.amount
        });
    }

    _emitPresaleChestPurchase(transaction, timestamp, eventData) {
        this.emit(this.PresaleChestPurchased, {
            tx: transaction,
            timestamp: timestamp / 1000,
            user: this._provider.address.fromHex(eventData.purchaser),
            referer: this._provider.address.fromHex(eventData.referer),
            chestId: eventData.chest,
            amount: eventData.amount
        });
    }

    _emitPayment(event) {
        this.emit(this.Payment, {
            paymentId: event.args.paymentId,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            divs: event.args.divs
        });
    }

    _emitDivsWithdrawal(event) {
        this.emit(this.DividendWithdrawal, {
            success: true,
            to: event.args.from,
            withdrawalId: event.args.withdrawalId,
            amount: event.args.amount,
            blockNumber: event.blockNumber,
            tx: event.transactionHash
        });
    }

    _emitWithdrawal(event) {
        if (eventData.from == "0x0000000000000000000000000000000000000000") {
            this.emit(this.DividendTokenWithdrawal, {
                success: true,
                to: this._provider.address.fromHex(eventData.to),
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
        return ethers.utils.getAddress(address);
    }

    async verifySign(nonce, message, address) {
        await this._ensureConnected();
        try {
            return await this._provider.trx.verifyMessage(this._provider.toHex(nonce), message, address);
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
        const values = [];
        const types = [];
        args.forEach(arg => {
            if (this.isAddress(arg)) {
                // assume that hex is address until other hex values will be used
                arg = ethers.utils.getAddress(arg);
                types.push("address");
            } else if (typeof arg === "string") {
                if (arg.substr(0, 2) == "0x") {
                    types.push("bytes");
                } else {
                    types.push("string");
                }
            } else {
                types.push("uint256");
            }

            values.push(arg);
        });
        const hash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(types, values));
        console.log(hash, ethers.utils.hashMessage(ethers.utils.arrayify(hash)))
        return this._signer.signMessage(ethers.utils.arrayify(hash));
    }

    async sendTransaction(contractAddress, payload, userId, signedTransaction) {
        try {
            const broadCastResponse = await this._provider.trx.sendRawTransaction(signedTransaction);

            if (broadCastResponse.code) {
                let reason;

                if (broadCastResponse.message) {
                    reason = this._provider.toUtf8(broadCastResponse.message);
                }

                this._emitTransactionFailed(contractAddress, signedTransaction.txID, payload, userId, reason);
                return;
            } else {
                this._trackTransactionFailure(contractAddress, payload, userId, signedTransaction.txID);
            }
        } catch (e) {
            this._trackTransactionFailure(contractAddress, payload, userId, signedTransaction.txID);
        }

        return signedTransaction.txID;
    }

    async trackTransactionStatus(contractAddress, payload, userId, transactionId) {
        this._trackTransactionFailure(contractAddress, payload, userId, transactionId, true);
    }

    // track failure, success will be tracked using events
    async _trackTransactionFailure(contractAddress, payload, userId, txID) {
        const output = await this._provider.trx.getTransactionInfo(txID);

        if (!Object.keys(output).length) {
            return setTimeout(() => {
                this._trackTransactionFailure(contractAddress, payload, userId, txID);
            }, TxFailureScanInterval);
        }

        if ((output.result && output.result == "FAILED") || !output.hasOwnProperty("contractResult")) {
            console.log("TX failed", contractAddress, JSON.stringify(output));
            this._emitTransactionFailed(
                contractAddress, txID, payload, userId, output.result
            );
        }
    }

    async _ensureConnected() {
        await this._provider.isConnected();
    }

    async getPaymentNonce(walletAddress) {
        const result =  await this._paymentContract.nonces(walletAddress);
        return result.valueOf();
    }

    async getDividendTokenNonce(walletAddress) {
        const result =  await this._stakingToken.nonces(walletAddress);
        return result.valueOf();
    }
}

module.exports = EthereumBlockchain;
