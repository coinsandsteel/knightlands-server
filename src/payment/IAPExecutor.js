const { Collections } = require("../database/database");

class IAPExecutor {
    constructor(db) {
        this._db = db;
        this._actions = {};
        this._iapToEvent = {};
    }

    // register async action for iap
    registerAction(iap, action) {
        this._actions[iap] = action;
    }

    mapIAPtoEvent(iap, event) {
        this._iapToEvent[iap] = event;
    }

    getEventByIAP(iap) {
        return this._iapToEvent[iap];
    }

    async executeIAP(iap, context) {
        let action = this._actions[iap];
        if (action) {
            return await action(context);
        }
    }
}

module.exports = IAPExecutor;