import Game from "./game";
const { Collections } = require("./database");
const Events = require("./knightlands-shared/events");
import Errors from "./knightlands-shared/errors"

class UserPremiumService {
    constructor(db) {
        this._db = db;
        this.UserPaymentTag = "user_payment";
        this.BeastBoostPurchaseTag = "beast_boost_purchase";
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
    }

    async getBeastBoostPurchaseStatus(userId) {
        return await Game.paymentProcessor.fetchPaymentStatus(userId, this.BeastBoostPurchaseTag, {
            "context.user": userId
        });
    }

    async _grantItem(userId, itemTemplate, count) {
        const user = await Game.getUser(userId);
        await user.inventory.autoCommitChanges(async inv => {
            await inv.addItemTemplate(itemTemplate, count);
        });
    }

    async requestBeatSoulPurchase(userId, purchaseIndex) {
        const beastMeta = await this._db.collection(Collections.Meta).findOne({_id: "beasts"});

        const iapMeta = beastMeta.iaps[purchaseIndex];
        if (!iapMeta) {
            throw Errors.UknownIAP;
        }

        let iapContext = {
            user: userId
        };

        // check if payment request already created
        let hasPendingPayment = await Game.paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.BeastBoostPurchaseTag);
        if (hasPendingPayment) {
            throw Errors.PaymentIsPending;
        }

        iapContext.item = beastMeta.ticketItem;
        iapContext.count = iapMeta.tickets;

        try {
            return await Game.paymentProcessor.requestPayment(
                userId,
                iapMeta.iap,
                this.BeastBoostPurchaseTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
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