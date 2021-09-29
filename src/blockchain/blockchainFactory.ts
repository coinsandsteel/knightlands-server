import Blockchains from "../knightlands-shared/blockchains";

const EthereumClient = require("./ethereum/client");
const MockBlockchain = require("./mockBlockchain");

const isProd = process.env.ENV == "prod";

export function createBlockchain(blockchainType) {
    switch (blockchainType) {
        case Blockchains.Ethereum:
            if (isProd) {
                const PaymentGateway = require("./artifacts/ethereum/PaymentGateway.json");
                const url = process.env.ETHEREUM_URL || "http://127.0.0.1:8545";
                return new EthereumClient(
                    Blockchains.Ethereum,
                    "ethereum",
                    { firstBlock: 13320800, scanInterval: 3000, confirmations: 7 },
                    { PaymentGateway },
                    url
                );
            } else {
                const PaymentGateway = require("./artifacts/goerli/PaymentGateway.json");
                const Flesh = require("./artifacts/goerli/Flesh.json");
                const PresaleCardsGate = require('./artifacts/goerli/PresaleCardsGate.json');
                const TokensDepositGateway = require("./artifacts/goerli/TokensDepositGateway.json");
                const url = process.env.ETHEREUM_URL || "http://127.0.0.1:8545";
                return new EthereumClient(
                    Blockchains.Ethereum,
                    "ethereum",
                    { firstBlock: 5197870, scanInterval: 15000, confirmations: 1 },
                    {
                        PaymentGateway,
                        Flesh,
                        PresaleCardsGate,
                        TokensDepositGateway
                    },
                    url
                );
            }
        case Blockchains.Polygon:
            {
                const PaymentGateway = require("./artifacts/polygon/PaymentGateway.json");
                const PresaleCardsGate = require('./artifacts/polygon/PresaleCardsGate.json');
                const url = process.env.POLYGON_URL || "http://127.0.0.1:8545";
                return new EthereumClient(
                    Blockchains.Polygon,
                    "matic-network",
                    { firstBlock: 19610505, scanInterval: 3000, confirmations: 50 },
                    {
                        PaymentGateway,
                        PresaleCardsGate
                    },
                    url
                );
            }

        case Blockchains.Mock:
            return new MockBlockchain();
    }

    return new MockBlockchain();
}
