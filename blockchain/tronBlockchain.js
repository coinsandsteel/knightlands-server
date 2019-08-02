const IBlockchainListener = require("./IBlockchainListener");
const IBlockchainSignVerifier = require("./IBlockchainSignVerifier");
const ClassAggregation = require("./../classAggregation");
const TronWeb = require("tronweb");

const { Collections } = require("../database");

class TronBlockchain extends ClassAggregation(IBlockchainListener, IBlockchainSignVerifier) {
    constructor(db) {
        super(db);

        this._db = db;
        this._events = {};
        this._tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            privateKey: 'da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0'
        });

        // load payment contract
        this._contractAddress = "";
    }

    scanEvents(fromBlock) {
        for (let event in this._events) {
            this._tronWeb.getEventResult()
        }

    }

    onEvent(event, callback) {
        this._events[event] = callback;
    }

    async verifySign(nonce, message, address) {
        await this._ensureConnected();
        await this._tronWeb.verifyMessage(tronWeb.toHex(nonce), message, address);
    }

    async _ensureConnected() {
        await this._tronWeb.isConnected();
    }
}

module.exports = TronBlockchain;