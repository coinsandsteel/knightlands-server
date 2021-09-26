import Blockchains from "../knightlands-shared/blockchains";

const EthereumClient = require("./ethereum/client");
const MockBlockchain = require("./mockBlockchain");

export function createBlockchain(blockchainType, db) {
    switch (blockchainType) {
        case Blockchains.Ethereum:
            {
                const PaymentGateway = require("./ethereum/PaymentGateway.json");
                const Flesh = require("./ethereum/Flesh.json");
                const PresaleCardsGate = require('./ethereum/PresaleCardsGate.json');
                const TokensDepositGateway = require("./ethereum/TokensDepositGateway.json");
                const url = process.env.ETHEREUM_URL || "http://127.0.0.1:8545";
                return new EthereumClient(
                    PaymentGateway,
                    Flesh,
                    PresaleCardsGate,
                    TokensDepositGateway,
                    url
                );
            }
        case Blockchains.Polygon:
            return new EthereumClient();

        case Blockchains.Mock:
            return new MockBlockchain();
    }

    return new MockBlockchain();
}
