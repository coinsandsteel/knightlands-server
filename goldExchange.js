
import Game from "./game";
import Errors from "./knightlands-shared/errors";
const { Collections } = require("./database.js");

class GoldExchange {
    constructor(data, user) {
        this._data = data;
        this._user = user;
    }

    async init() {
        this._meta = await Game.db.collection(Collections.Meta).findOne({_id: "goldExchange"});
        this._checkCycle();
    }

    get levelMeta() {
        return {
            expRequired: this.expRequired,
            currentLevelMeta: this._meta.levels[this._data.level]
        }
    }

    get expRequired() {
        if (this._data.level == this._meta.levels.length - 1) {
            return 0;
        }

        return this._meta.levels[this._data.level + 1].expRequired;
    }

    freeBoost() {
        this._checkCycle();

        if (this._data.freeBoosts >= this._meta.freeBoosts) {
            throw Errors.GoldExchangeNoFreeBoosts;
        }

        this._data.freeBoosts++;
        this._addExp(this._meta.expPerBoost);
    }

    premiumBoost(count) {
        this._checkCycle();

        this._data.premiumBoosts += count;
        this._addExp(this._meta.expPerPremiumBoost * count);

        return this._data;
    }

    obtainGold() {
        this._checkCycle();

        if (this._data.freeObtains >= this._meta.freeExchanges) {
            throw Errors.GoldExchangeNoFreeChanges;
        }

        this._data.freeObtains++;
        this._user.addSoftCurrency(this._meta.levels[this._data.level].obtainedGold);
    }

    _checkCycle() {
        const rewardCycle = this._user.getDailyRewardCycle();
        if (this._data.cycle != rewardCycle) {
            this._data.cycle = rewardCycle;
            this._data.freeBoosts = 0;
            this._data.premiumBoosts = 0;
            this._data.freeObtains = 0;
        }
    }

    _addExp(exp) {
        this._data.exp += exp;

        const maxLevel = this._meta.levels.length - 1;
        while (this._data.level < maxLevel) {
            const expRequired = this.expRequired;
            if (this._data.exp >= expRequired) {
                this._data.exp -= expRequired;
                this._user.addSoftCurrency(this._meta.levels[this._data.level].levelUpGold);
                this._data.level++;
            } else {
                break;
            }
        }
    }
}

module.exports = GoldExchange;