import Blockchains from "./knightlands-shared/blockchains";

module.exports = {
    botApiKey: "YDX7n4n%*bVM^c=BNLNwXAckwxE?yPEV",
    blockchain: Blockchains.Tron,
    conversionService: {
        refreshInterval: 1, // in minutes
        sandboxEndpoint: { uri: "https://sandbox-api.coinmarketcap.com/", apiKey: "71ea0d21-dcfe-4f84-9e0b-96dab7120053" },
        endpoint: { uri: "https://pro-api.coinmarketcap.com/", apiKey: "0a581cb5-8fa2-4d45-96f8-59f5339b66e0" }
    }
};