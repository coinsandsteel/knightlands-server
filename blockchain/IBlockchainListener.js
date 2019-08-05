const EventEmitter = require('events');

class IBlockchainListener extends EventEmitter {
    constructor() {
        super();

        this.Payment = "default-payment-event";
        this.PaymentFailed = "default-payment-failed-event";
    }

    async scanEvents() {

    }
}

module.exports = IBlockchainListener;