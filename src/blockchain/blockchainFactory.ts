import Blockchains from "../knightlands-shared/blockchains";

const EthereumClient = require("./ethereum/client");
const MockBlockchain = require("./mockBlockchain");

export function createBlockchain(blockchainType, db) {
    switch (blockchainType) {
        case Blockchains.Ethereum:
            return new EthereumClient(db);

        case Blockchains.Mock:
            return new MockBlockchain(db);
    }

    return new MockBlockchain(db);
}
