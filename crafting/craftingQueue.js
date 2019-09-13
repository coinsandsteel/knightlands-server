import Game from "../game";
const { Collections } = require("../database");
const Events = require("../knightlands-shared/events");

class CraftingQueue {
    constructor(db) {
        this._db = db;
    }

    get CraftPaymentTag() {
        return "craft_item";
    }

    async init(iapExecutor) {
        console.log("Registering Crafting IAPs...");

        let allRecipes = await this._db.collection(Collections.CraftingRecipes).find({crafted:true}).toArray();
        allRecipes.forEach(recipe => {
            if (!recipe.iap) {
                return;
            }

            iapExecutor.registerAction(recipe.iap, async (context) => {
                return await this._craftRecipe(context.user, context.recipe);
            });

            iapExecutor.mapIAPtoEvent(recipe.iap, Events.CraftingStatus);
        });
    }

    async _craftRecipe(userId, recipeId) {
        let user;
        let controller = await Game.getPlayerController(userId);
        if (controller) {
            user = await controller.getUser();
        } else {
            user = await Game.loadUser(userId);
        }

        return await user.crafting.craftPayedRecipe(recipeId);
    }

    async requestCraftingPayment(userId, recipe) {
        let iapContext = {
            user: userId,
            recipe: recipe._id
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
                iapContext
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
}

module.exports = CraftingQueue; 