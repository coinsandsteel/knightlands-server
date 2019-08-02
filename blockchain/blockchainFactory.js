import Blockchains from "./../knightlands-shared/blockchains";

const TronBlockchain = require("./tronBlockchain");
const MockBlockchain = require("./mockBlockchain");

module.exports = (blockchainType, db) => {
    switch (blockchainType) {
        case Blockchains.Tron:
            return new TronBlockchain(db);

        case Blockchains.Mock:
            return new MockBlockchain(db);
    }

    return new MockBlockchain(db);
}