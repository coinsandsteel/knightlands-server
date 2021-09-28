const IBlockchainListener = require("../IBlockchainListener");
const IBlockchainSigner = require("../IBlockchainSigner");
const ClassAggregation = require("../../classAggregation");
const { ethers } = require("ethers");
import Game from "../../game";

const { Collections } = require("../../database/database");

import blockchains from "../../knightlands-shared/blockchains";
import currency_type from "../../knightlands-shared/currency_type";
import CurrencyType from "../../knightlands-shared/currency_type";
import { Blockchain } from "../Blockchain";

const BlocksRange = 500;
const EventsScanned = "eventsScanned";

class EthereumBlockchain extends ClassAggregation(IBlockchainListener, IBlockchainSigner) {
    constructor(
        currency, { firstBlock, scanInterval, confirmations }, {
            PaymentGateway,
            Flesh,
            PresaleCardsGate,
            TokensDepositGateway,
        },
        url
    ) {
        super();

        this.firstBlock = firstBlock;
        this.scanInterval = scanInterval;
        this.confirmations = confirmations;

        this.currency = currency;

        this.PaymentGateway = PaymentGateway;
        this.Flesh = Flesh;

        this.Payment = Blockchain.Payment;
        this.PresaleCardDeposit = Blockchain.PresaleCardDeposit;
        this.DividendTokenWithdrawal = Blockchain.DividendTokenWithdrawal;
        this.BurntTokenWithdrawal = Blockchain.BurntTokenWithdrawal;
        this.DividendWithdrawal = Blockchain.DividendWithdrawal;

        this._eventsReceived = 0;
        this._eventWatchers = {};

        this._provider = new ethers.providers.JsonRpcProvider(url);
        this._signer = new ethers.Wallet(process.env.PK, this._provider);

        this._paymentContract = new ethers.Contract(PaymentGateway.address, PaymentGateway.abi, this._provider);

        if (PresaleCardsGate) {
            this._presaleGate = new ethers.Contract(PresaleCardsGate.address, PresaleCardsGate.abi, this._provider);
        }

        if (Flesh) {
            this._stakingToken = new ethers.Contract(Flesh.address, Flesh.abi, this._provider);
        }

        if (TokensDepositGateway) {
            this._tokenGateway = new ethers.Contract(TokensDepositGateway.address, TokensDepositGateway.abi, this._provider);
        }
    }

    getNativeCurrency() {
        return this.currency;
    }

    get PaymentGatewayAddress() {
        return this.PaymentGateway.address;
    }

    get DividendTokenAddress() {
        return this.Flesh.address;
    }

    async getTime() {
        const block = await this._provider.getBlock()
        return block.timestamp;
    }

    getTokenAddress(currency) {
        if (currency == CurrencyType.Dkt) {
            return this.Flesh.address;
        }
        return "0x0";
    }

    convertTokenAmount(str, decimals = 6) {
        let decimal = "";
        if (str != "0") {
            if (str.length < decimals) {
                str = str.padStart(decimals - str.length, "0");
                decimal = "0." + str.slice(0, str.length);
            } else {
                decimal =
                    str.slice(0, str.length - decimals) +
                    "." +
                    str.slice(str.length - decimals);
            }
        }

        return Number(decimal);
    }

    getBigIntNativeAmount(amount) {
        let str = amount.toString();
        const parts = str.split(".");
        let base = parts[0].length;
        if (parts.length == 2) {
            str = str.replace(".", "");

            if (parts[0] == "0") {
                str = str.substr(1);
                const b = str.length;
                str = str.replace(/^0+/, "");
                base = str.length - b;
            }
        }

        return BigInt(str.padEnd(18 + base, "0"));
    }


    getBigIntDivTokenAmount(amount) {
        // with 6 decimals and known inflation rate, this is safe conversion
        return BigInt(Math.floor(amount * Math.pow(10, 6)).toString());
    }

    getNumberDivTokenAmount(bigInt) {
        const str = bigInt.toString();
        let decimal = "0";
        if (str != "0") {
            decimal = str.slice(0, str.length - 6) + "." + str.slice(str.length - 6);
        }
        return Number(decimal);
    }

    async _watchNewBlocks() {
        let blockNumber = await this._provider.getBlockNumber()
        await this._updateLastScanTimestamp(blockNumber);

        setTimeout(this._watchNewBlocks.bind(this), this.scanInterval);
    }

    isAddress(addr) {
        return ethers.utils.isAddress(addr)
    }

    _watchEvent(eventName, eventFilter, contract, handler) {
        this._eventWatchers = setTimeout(this._scanEventsFor.bind(this, eventName, eventFilter, contract, handler), 3000);
    }

    async _scanEventsFor(eventName, eventFilter, contract, handler) {
        try {
            let eventsScanned = await Game.dbClient.db.collection(Collections.Services).findOne({
                chain: blockchains.Ethereum,
                type: EventsScanned,
                event: eventName
            });

            const lastBlock = (await this._provider.getBlockNumber()) - this.confirmations;

            let startBlock = (eventsScanned || {}).lastScan || this.firstBlock;
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
        } catch (exc) {
            console.error(exc)
        } finally {
            this._watchEvent(eventName, eventFilter, contract, handler);
        }
    }

    async _scanEvents() {
        console.log("Scanning missed events...");

        this._watchEvent("Purchase", this._paymentContract.filters.Purchase(), this._paymentContract, this._emitPayment);
        this._watchEvent("Withdrawal", this._paymentContract.filters.Withdrawal(), this._paymentContract, this._emitDivsWithdrawal);
        // this._watchEvent("Withdrawal", this._stakingToken.filters.Withdrawal(), this._stakingToken, this._emitWithdrawal(this.DividendTokenWithdrawal));
        if (this._presaleGate) {
            this._watchEvent("Deposit", this._presaleGate.filters.Deposit(), this._presaleGate, this._emitPresaleCardDeposit);
        }

        // this._watchEvent("TokenDeposit", this._tokenGateway.filters.Deposit(), this._tokenGateway, this._emitDeposit);

        console.log("Scan finished.");
    }

    async start() {
        await this._scanEvents();
    }

    async _updateLastEventReceived(blockNumber, eventName) {
        await Game.db.collection(Collections.Services).updateOne({ type: EventsScanned, event: eventName, chain: blockchains.Ethereum }, { $set: { lastScan: blockNumber + 1 } }, { upsert: true });
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
            amount: event.args.amount.toString(),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        });
    }

    _emitPresaleCardDeposit(event) {
        this.emit(Blockchain.PresaleCardDeposit, {
            depositId: event.args.depositId,
            to: event.args.from,
            tokenIds: event.args.tokensIds,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        });
    }

    _emitDeposit(event) {
        this.emit(Blockchain.TokenDeposit, {
            depositorId: event.args.depositor,
            token: event.args.token,
            from: event.args.from,
            amount: event.args.amount.toString(),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        })
    }

    _emitWithdrawal(evtName) {
        return function(event) {
            this.emit(evtName, {
                withdrawalId: event.args.requestId,
                to: event.args.to,
                amount: event.args.value.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                token: event.emitter
            });
        }
    }

    addressForSigning(address) {
        return ethers.utils.getAddress(address);
    }

    _isHex(string) {
        return (typeof string === 'string' &&
            !isNaN(parseInt(string, 16)) &&
            /^(0x|)[a-fA-F0-9]+$/.test(string));
    }

    async sign(...args) {
        const values = [];
        const types = [];
        args.forEach(arg => {
            if (this.isAddress(arg)) {
                // assume that hex is address until other hex values will be used
                arg = ethers.utils.getAddress(arg);
                types.push("address");
            } else if (typeof arg == 'bigint') {
                values.push(ethers.BigNumber.from(arg.toString()));
                types.push('uint256');
                return;
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
        return this._signer.signMessage(ethers.utils.arrayify(hash));
    }

    async getPaymentNonce(walletAddress) {
        const result = await this._paymentContract.nonces(walletAddress);
        return result.valueOf();
    }

    async getTokenNonce(walletAddress, type) {
        let result;

        if (type == currency_type.Dkt) {
            result = await this._stakingToken.nonces(walletAddress);
        }

        return result.valueOf();
    }

    async getDividendTokenNonce(walletAddress) {
        const result = await this._stakingToken.nonces(walletAddress);
        return result.valueOf();
    }
}

module.exports = EthereumBlockchain;