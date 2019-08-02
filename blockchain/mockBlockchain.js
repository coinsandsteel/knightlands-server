const IBlockchainListener = require("./IBlockchainListener");
const IBlockchainSignVerifier = require("./IBlockchainSignVerifier");
const ClassAggregation = require("./../classAggregation");

class MockBlockchain extends ClassAggregation(IBlockchainListener, IBlockchainSignVerifier) {
    constructor(db) {
        super(db);
        this._db = db;
        this._events = {};
    }

    scanEvents(fromBlock) {

    }

    onEvent(event, callback) {
        this._events[event] = callback;
    }

    async verifySign(nonce, message, address) {
        return true;
    }
}

module.exports = MockBlockchain;