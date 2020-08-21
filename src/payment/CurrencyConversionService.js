const rp = require('request-promise-native');
import Blockchains from "./../knightlands-shared/blockchains";

class CurrencyConversionService {
    constructor(blockchain, config) {
        // minutes -> milliseconds
        switch (blockchain) {
            case Blockchains.Tron:
                this._primaryCurrency = "TRX";
                this._nativeConversion = 1000000;
                break;

            case Blockchains.Waves:
                this._primaryCurrency = "WAVES";
                break;

            case Blockchains.EOS:
                this._primaryCurrency = "EOS";
                break;

            case Blockchains.Ethereum:
                this._primaryCurrency = "ETH";
                break;
        }

        this._refreshInterval = config.refreshInterval * 60 * 1000;

        let env = (process.env.ENV || "dev");

        this._endPoint = (env == "dev" || env == "test" || end == "local") ? config.sandboxEndpoint : config.endpoint;

        this._conversionRates = {};

        // use coinsmarketcap for this purpose
        // this._pullConversionRates();
    }

    get conversionRate() {
        // return this._conversionRate.price;
        return 0.011;
    }

    convertToNative(usdPrice) {
        return Math.floor(usdPrice * this.conversionRate * this._nativeConversion);
    }

    async _pullConversionRates() {
        const requestOptions = {
            method: 'GET',
            uri: `${this._endPoint.uri}v1/tools/price-conversion`,
            headers: {
                'X-CMC_PRO_API_KEY': this._endPoint.apiKey
            },
            qs: {
                'symbol': 'USD',
                'amount': '0.01',
                'convert': this._primaryCurrency
            },
            json: true,
            gzip: true
        };

        try {
            let response = await rp(requestOptions);

            this._conversionRate = response.data.quote[this._primaryCurrency];
        } catch (exc) {
            console.log("Price pull exception", exc);
        }

        setTimeout(this._pullConversionRates.bind(this), this._refreshInterval);
    }
};

module.exports = CurrencyConversionService;
