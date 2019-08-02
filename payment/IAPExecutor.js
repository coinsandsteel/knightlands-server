const { Collections } = require("../database");

class IAPExecutor {
    constructor(db) {
        this._db = db;
        this._actions = {};
    }

    // register async callback for iap
    registerAction(iap, action) {
        this._actions[iap] = action;
    }

    async executeIAP(iap, context) {
        let action = this._actions[iap];
        if (action) {
            await action(context);
        }
    }
}

module.exports = IAPExecutor;