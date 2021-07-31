import Game from "./game";
const { Collections } = require("./database/database");
const Events = require("./knightlands-shared/events");
import Errors from "./knightlands-shared/errors";
import TrialType from "./knightlands-shared/trial_type";

class UserPremiumService {
    constructor(db) {
        this._db = db;
        this.UserPaymentTag = "user_payment";
        this.BeastBoostPurchaseTag = "beast_boost_purchase";
        this.TrialAttemptsPurchaseTag = "trial_attempts_purchase";
        this.TowerAttemptsPurchaseTag = "tower_attempts_purchase";
        this.GoldExchangeTag = "gold_exchange_purchase";
    }

    async init(iapExecutor) {
        console.log("Registering User Premium IAPs...");

        const refills = await this._db.collection(Collections.Meta).find({_id: {
            $in: ["energy_refill_cost", "stamina_refill_cost"]
        }}).toArray();

        refills.forEach(refillCosts => {
            if (!refillCosts.cost) {
                return;
            }

            refillCosts.cost.forEach(cost => {
                if (!cost.iap) {
                    return;
                }

                iapExecutor.registerAction(cost.iap, async context => {
                    return await this._refillUserTimer(context.user, context.stat, context.refills);
                });
    
                iapExecutor.mapIAPtoEvent(cost.iap, Events.TimerRefilled);
            });
        });

        const beastMeta = await this._db.collection(Collections.Meta).findOne({_id: "beasts"});
        beastMeta.iaps.forEach(iapMeta=>{
            iapExecutor.registerAction(iapMeta.iap, async context=>{
                return await this._grantItem(context.user, context.item, context.count);
            });

            iapExecutor.mapIAPtoEvent(iapMeta.iap, Events.ItemPurchased);
        });

        const trialsMeta = await this._db.collection(Collections.Meta).find({
            _id: {
                $in: [`${TrialType.Armour}_trials`, `${TrialType.Weapon}_trials`, `${TrialType.Accessory}_trials`]
            }
        }).toArray();

        trialsMeta.forEach(meta=>{
            meta.iaps.forEach(iap=>{
                iapExecutor.registerAction(iap.iap, async context=>{
                    return await this._grantTrialAttempts(context.user, context.trialType, context.count);
                });
    
                iapExecutor.mapIAPtoEvent(iap.iap, Events.TrialAttemptsPurchased);
            });
        });

        const towerMeta = await this._db.collection(Collections.TowerMeta).findOne({_id: "misc"});
        towerMeta.iaps.forEach(iap=>{
            iapExecutor.registerAction(iap.iap, async context=>{
                return await this._grantItem(context.user, context.item, context.count);
            });

            iapExecutor.mapIAPtoEvent(iap.iap, Events.TowerAttemptsPurchased);
        });

        this.goldExchangeMeta = await this._db.collection(Collections.Meta).findOne({_id: "goldExchange"});
        this.goldExchangeMeta.iaps.forEach(iap=>{
            iapExecutor.registerAction(iap.iap, async context=>{
                return await this._premiumBoostGoldExchange(context.user, context.count);
            });
    
            iapExecutor.mapIAPtoEvent(iap.iap, Events.GoldExchangeBoostPurchased);
        });
    }

    async requireGoldExchangeBoost(userId, count) {
        if (!Number.isInteger(count) || count < 1) {
            throw Errors.IncorrectArguments;
        }

        const iapMeta = this.goldExchangeMeta.iaps.find(x=>x.count == count);
        if (!iapMeta) {
            throw Errors.IncorrectArguments;
        }

        let iapContext = {
            user: userId,
            count: count
        };

        // check if payment request already created
        let hasPendingPayment = await Game.paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.GoldExchangeTag);
        if (hasPendingPayment) {
            throw Errors.PaymentIsPending;
        }

        try {
            return await Game.paymentProcessor.requestPayment(
                userId,
                iapMeta.iap,
                this.GoldExchangeTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
    }

    async getGoldExchangePremiumStatus(userId) {
        return await Game.paymentProcessor.fetchPaymentStatus(userId, this.GoldExchangeTag, {
            "context.user": userId
        });
    }

    async requestTowerAttemptsPurchase(userId, purchaseIndex) {
        const towerMeta = await this._db.collection(Collections.TowerMeta).findOne({_id: "misc"});

        if (!towerMeta) {
            throw Errors.IncorrectArguments;
        }

        const iapMeta = towerMeta.iaps[purchaseIndex];
        if (!iapMeta) {
            throw Errors.UknownIAP;
        }

        let iapContext = {
            user: userId,
            count: iapMeta.attempts,
            item: towerMeta.ticketItem
        };

        // check if payment request already created
        let hasPendingPayment = await Game.paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.TowerAttemptsPurchaseTag);
        if (hasPendingPayment) {
            throw Errors.PaymentIsPending;
        }

        try {
            return await Game.paymentProcessor.requestPayment(
                userId,
                iapMeta.iap,
                this.TowerAttemptsPurchaseTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
    }

    async getTowerAttemptsPurchaseStatus(userId) {
        return await Game.paymentProcessor.fetchPaymentStatus(userId, this.TowerAttemptsPurchaseTag, {
            "context.user": userId
        });
    }

    async requestTrialAttemptsPurchase(userId, trialType, purchaseIndex) {
        const trialsMeta = await this._db.collection(Collections.Meta).findOne({_id: `${trialType}_trials`});

        if (!trialsMeta) {
            throw Errors.IncorrectArguments;
        }

        const iapMeta = trialsMeta.iaps[purchaseIndex];
        if (!iapMeta) {
            throw Errors.UknownIAP;
        }

        let iapContext = {
            user: userId,
            trialType,
            count: iapMeta.attempts
        };

        // check if payment request already created
        let hasPendingPayment = await Game.paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.TrialAttemptsPurchaseTag);
        if (hasPendingPayment) {
            throw Errors.PaymentIsPending;
        }

        try {
            return await Game.paymentProcessor.requestPayment(
                userId,
                iapMeta.iap,
                this.TrialAttemptsPurchaseTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
    }

    async getTrialAttemptsPurchaseStatus(userId, trialType) {
        return await Game.paymentProcessor.fetchPaymentStatus(userId, this.TrialAttemptsPurchaseTag, {
            "context.user": userId,
            "context.trialType": trialType
        });
    }

    async _grantTrialAttempts(userId, trialType, count) {
        const user = await Game.getUser(userId);
        user.grantTrialAttempts(trialType, count);
        await user.commitChanges();
        return {
            trialType, count
        };
    }

    async getBeastBoostPurchaseStatus(userId) {
        return await Game.paymentProcessor.fetchPaymentStatus(userId, this.BeastBoostPurchaseTag, {
            "context.user": userId
        });
    }

    async _premiumBoostGoldExchange(userId, count) {
        const user = await Game.getUser(userId);
        const response = user.goldExchange.premiumBoost(count);
        await user.commitChanges();
        return response;
    }

    async _grantItem(userId, itemTemplate, count) {
        const user = await Game.getUser(userId);
        await user.inventory.autoCommitChanges(async inv => {
            await inv.addItemTemplate(itemTemplate, count);
        });
    }

    async requestRefillPayment(userId, stat) {
        let iapContext = {
            user: userId,
            stat: stat,
            refills: 0
        };

        // check if payment request already created
        let hasPendingPayment = await Game.paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.UserPaymentTag);
        if (hasPendingPayment) {
            throw Errors.PaymentIsPending;
        }

        let user = await Game.getUser(userId);
        iapContext.refills = user.getRefillsCount(stat);
        let refillCost = await user.getTimerRefillCost(stat);

        try {
            return await Game.paymentProcessor.requestPayment(
                userId,
                refillCost.iap,
                this.UserPaymentTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
    }

    async getTimerRefillStatus(userId, stat) {
        return await Game.paymentProcessor.fetchPaymentStatus(userId, this.UserPaymentTag, {
            "context.user": userId,
            "context.stat": stat
        });
    }

    async _refillUserTimer(userId, stat, refills) {
        let user = await Game.getUser(userId);
        user.refillTimer(stat, refills);
        await user.commitChanges();
        return stat;
    }
}

module.exports = UserPremiumService;
