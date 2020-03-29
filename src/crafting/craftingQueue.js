import Game from "../game";
const { Collections } = require("../database");
const Events = require("../knightlands-shared/events");
import PaymentStatus from "../knightlands-shared/payment_status";

class CraftingQueue {
    constructor(db) {
        this._db = db;
    }

    get CraftPaymentTag() {
        return "craft_item";
    }

    get EnchantingPaymentTag() {
        return "enchant_item";
    }

    async init(iapExecutor) {
        console.log("Registering Crafting IAPs...");

        let allRecipes = await this._db.collection(Collections.CraftingRecipes).find({ crafted: true }).toArray();
        allRecipes.forEach(recipe => {
            if (!recipe.iap) {
                return;
            }

            iapExecutor.registerAction(recipe.iap, async context => {
                return await this._craftRecipe(context.user, context.recipe, context.amount);
            });

            iapExecutor.mapIAPtoEvent(recipe.iap, Events.CraftingStatus);
        });

        let enchantingSteps = await this._db.collection(Collections.Meta).findOne({ _id: "enchanting_meta" });
        for (let rarity in enchantingSteps.steps) {
            let stepData = enchantingSteps.steps[rarity];
            stepData.steps.forEach(step => {
                if (!step.iap) {
                    return;
                }

                iapExecutor.registerAction(step.iap, async context => {
                    return await this._enchantItem(context.user, context.itemId);
                });

                iapExecutor.mapIAPtoEvent(step.iap, Events.ItemEnchanted);
            });
        }
    }

    async _craftRecipe(userId, recipeId, amount) {
        let user = await Game.getUser(userId);
        return await user.crafting.craftPayedRecipe(recipeId, amount);
    }

    async requestCraftingPayment(userId, recipe, amount) {
        let iapContext = {
            user: userId,
            recipe: recipe._id,
            amount
        };

        // check if payment request already created
        let hasPendingPayment = await Game.paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.CraftPaymentTag);
        if (hasPendingPayment) {
            throw "crafting in process already";
        }

        try {
            return await Game.paymentProcessor.requestPayment(
                userId,
                recipe.iap,
                this.CraftPaymentTag,
                iapContext,
                amount
            );
        } catch (exc) {
            throw exc;
        }
    }

    async getCraftingStatus(userId, recipeId) {
        recipeId *= 1;

        return await Game.paymentProcessor.fetchPaymentStatus(userId, this.CraftPaymentTag, {
            "context.user": userId,
            "context.recipe": recipeId
        });
    }

    async _enchantItem(userId, itemId) {
        let user = await Game.getUser(userId);
        return await user.autoCommitChanges(async ()=>{
            return await user.crafting.enchantPayed(itemId);
        });
    }

    async requestEnchantingPayment(userId, iap, item) {
        let iapContext = {
            user: userId,
            itemId: item.id
        };

        // check if payment request already created
        let hasPendingPayment = await Game.paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.EnchantingPaymentTag);
        if (hasPendingPayment) {
            throw "enchanting in process already";
        }

        try {
            return await Game.paymentProcessor.requestPayment(
                userId,
                iap,
                this.EnchantingPaymentTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
    }

    async getEnchantingStatus(userId, itemId) {
        itemId *= 1;

        return await Game.paymentProcessor.fetchPaymentStatus(userId, this.EnchantingPaymentTag, {
            "context.user": userId,
            "context.itemId": itemId
        });
    }

    async isEnchantingInProcess(userId, itemId) {
        let status = await Game.craftingQueue.getEnchantingStatus(userId, itemId);
        return (status || {}).status == PaymentStatus.Pending || (status || {}).status == PaymentStatus.WaitingForTx;
    }
}

module.exports = CraftingQueue; 