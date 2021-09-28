const rp = require('request-promise-native');
import CurrencyType from "../knightlands-shared/currency_type";

class CurrencyConversionService {
    constructor() {
        this._refreshInterval = 1800000;
        this._retries = 10;
        this._requests = [];

        this._conversionRates = {
            [CurrencyType.Dkt]: 0.75,
            [CurrencyType.Dkt2]: 0.75,
            ["ethereum"]: 1,
            ["polygon"]: 1
        };

        this._requests.push({
            method: 'GET',
            uri: `https://api.coingecko.com/api/v3/simple/price`,
            qs: {
                'ids': 'ethereum,matic-network',
                'vs_currencies': 'usd'
            },
            json: true,
            gzip: true
        });

        this._pullConversionRates();
    }

    conversionRate(currency) {
        return this._conversionRates[currency] || 0;
    }

    convertToNative(currency, usdPrice) {
        // usdPrice in cents
        return usdPrice * this.conversionRate(currency) / 100;
    }

    async _withRetry(request, retries) {
        try {
            const response = await rp(request);
            for (const currency in response) {
                this._conversionRates[currency] = response[currency].usd;
            }

        } catch (e) {
            if (retries == 0) {
                throw e;
            }

            await this._withRetry(request, retries - 1);
        }
    }

    async _pullConversionRates() {
        for (const request of this._requests) {
            try {
                await this._withRetry(request, this._retries);
            } catch (exc) {
                console.log("Price pull exception", exc);
            }
        }


        setTimeout(this._pullConversionRates.bind(this), this._refreshInterval);
    }
};

module.exports = CurrencyConversionService;