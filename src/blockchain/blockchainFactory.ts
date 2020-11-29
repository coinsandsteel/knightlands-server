import Blockchains from "../knightlands-shared/blockchains";

const TronBlockchain = require("./tron/tronBlockchain");
const MockBlockchain = require("./mockBlockchain");

export function createBlockchain(blockchainType, db) {
    switch (blockchainType) {
        case Blockchains.Tron:
            return new TronBlockchain(db);

        case Blockchains.Mock:
            return new MockBlockchain(db);
    }

    return new MockBlockchain(db);
}
