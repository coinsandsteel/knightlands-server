const rp = require('request-promise-native');
import Blockchains from "../knightlands-shared/blockchains";
import CurrencyType from "../knightlands-shared/currency_type";

class CurrencyConversionService {
    constructor() {
        this._refreshInterval = 1800000;
        this._requests = {};

        this._conversionRates = {
            [CurrencyType.Dkt]: 0.75,
            [CurrencyType.Dkt2]: 0.75,
            ["ethereum"]: 1,
            ["polygon"]: 1
        };

        this._requests["ethereum"] = {
            method: 'GET',
            uri: `https://api.coingecko.com/api/v3/simple/price`,
            qs: {
                'ids': 'ethereum',
                'vs_currencies': 'usd'
            },
            json: true,
            gzip: true
        };

        // this._requests["polygon"] = {
        //     method: 'GET',
        //     uri: `https://api.coingecko.com/api/v3/simple/price`,
        //     qs: {
        //         'ids': 'matic-network',
        //         'vs_currencies': 'usd'
        //     },
        //     json: true,
        //     gzip: true
        // };

        // this._requests["dkt"] = {
        //     method: 'GET',
        //     uri: `https://api.coingecko.com/api/v3/simple/price`,
        //     qs: {
        //         'ids': 'matic-network',
        //         'vs_currencies': 'usd'
        //     },
        //     json: true,
        //     gzip: true
        // };

        this._pullConversionRates();
    }

    conversionRate(currency) {
        return this._conversionRates[currency] || 0;
    }

    convertToNative(currency, usdPrice) {
        // usdPrice in cents
        return usdPrice * this.conversionRate(currency) / 100;
    }

    async _pullConversionRates() {
        for (const currency in this._requests) {
            try {
                let response = await rp(this._requests[currency]);
                console.log(response)

                this._conversionRates[currency] = response[currency].usd;
            } catch (exc) {
                console.log("Price pull exception", exc);
            }
        }


        setTimeout(this._pullConversionRates.bind(this), this._refreshInterval);
    }
};

module.exports = CurrencyConversionService;