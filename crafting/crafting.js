import Game from "../game";
import Errors from "../knightlands-shared/errors";
const Events = require("../knightlands-shared/events");
const { Collections } = require("../database");
import CurrencyType from "../knightlands-shared/currency_type";

const {
    EquipmentSlots,
    getSlot
} = require("../knightlands-shared/equipment_slot");

const ItemType = require("../knightlands-shared/item_type");

class Crafting {
    constructor(userId, inventory) {
        this._inventory = inventory;
        this._userId = userId;
        this.CraftPaymentTag = "craft_item";
    }

    // check pre-conditions, ask for payment if necessary
    async craftRecipe(recipeId, currency) {
        recipeId *= 1;

        let recipe = await this._loadRecipe(recipeId);
        if (!recipe) {
            throw Errors.NoRecipe;
        }

        if (!(await this._inventory.hasEnoughIngridients(recipe.ingridients))) {
            throw Errors.NoRecipeIngridients;
        }

        if (currency == CurrencyType.Fiat) {
            return await Game.craftingQueue.requestCraftingPayment(this._userId, recipe);
        } else {
            // check the balance
            let recipeCost = recipe.soft;
            if (currency == CurrencyType.Hard) {
                recipeCost = recipe.hard;
            }

            if (this._inventory.getCurrency(currency) < recipeCost) {
                throw Errors.NotEnoughCurrency;
            }

            // deduct fee
            this._inventory.modifyCurrency(currency, -recipeCost);
        }

        // consume ingridients now, even if it's fiat payment, they will be forced to pay money.
        // prevents problems when payment is delayed and ingridients are used somewhere else which leads to increased UX friction
        await this._inventory.consumeItemsFromCraftingRecipe(recipe);

        if (currency == CurrencyType.Fiat) {
            return;
        }

        return await this.craftPayedRecipe(recipe);
    }

    // just craft as final step
    async craftPayedRecipe(recipe) {
        if (typeof recipe != "object") {
            recipe = await this._loadRecipe(recipe);
        }

        await this._inventory.addItemTemplate(recipe.resultItem);

        return recipe;
    }

    async unbindItem(itemId, items) {
        itemId *= 1;

        await this._inventory.loadAllItems();

        let item = this._inventory.getItemById(itemId);
        if (!item) {
            throw Errors.NoItem;
        }

        // if item is not unique - it should be converted to unique and assigned new id to make it stand out from default stack
        if (!item.unique) {
            item = this._inventory.makeUnique(item);
        }

        let itemTemplate = await Game.itemTemplates.getTemplate(item.template);
        if (!itemTemplate) {
            throw Errors.NoTemplate;
        }

        let unbindLevels = 0;
        // check that items are valid as material
        for (let i in items) {
            let materialItem = this._inventory.getItemById(i);
            if (!materialItem) {
                throw Errors.NoItem;
            }

            if (materialItem.template != item.template) {
                throw Errors.IncorrectArguments;
            }

            unbindLevels += items[i] * 1;
        }

        if (unbindLevels < 1 && unbindLevels > 2) {
            throw Errors.IncorrectArguments;
        }

        // remove items
        for (let i in items) {
            this._inventory.removeItem(i, items[i]);
        }

        // increase unbind level
        item.breakLimit += unbindLevels;
        // mark item to update in database
        this._inventory.setItemUpdated(item);

        return item.id;
    }

    async upgradeItem(itemId, material, count) {
        itemId *= 1;
        material *= 1;

        if (!Number.isInteger(count) || count < 1) {
            throw Errors.IncorrectArguments;
        }

        await this._inventory.loadAllItems();

        let item = this._inventory.getItemById(itemId);
        if (!item) {
            throw Errors.NoItem;
        }

        // if item is not unique - it should be converted to unique and assigned new id to make it stand out from default stack
        if (!item.unique) {
            item = this._inventory.makeUnique(item);
        }

        // if material type is item itself
        if (itemId === material) {
            throw Errors.IncorrectArguments;
        }

        let upgradeMeta = await this._getUpgradeMeta();
        let itemTemplate = await Game.itemTemplates.getTemplate(item.template);
        if (!itemTemplate) {
            throw Errors.NoTemplate;
        }

        let meta = await this._getMeta();
        let maxLevel = meta.itemLimitBreaks[itemTemplate.rarity][item.breakLimit];
        if (item.level >= maxLevel) {
            throw Errors.ItemMaxLevel;
        }

        // check if material item can be used as leveling material 
        let materialItem = this._inventory.getItemById(material);
        if (!materialItem) {
            throw Errors.NoMaterial;
        }

        let materialTemplate = await Game.itemTemplates.getTemplate(materialItem.template);
        if (!materialTemplate) {
            throw Errors.NoTemplate;
        }

        let expPerMaterial = 0;
        let levelingMeta = upgradeMeta.levelingMeta[getSlot(itemTemplate.equipmentType)];
        let materialSlot = getSlot(materialTemplate.equipmentType);

        if (materialTemplate.type == ItemType.Equipment && levelingMeta.materialSlots.includes(materialSlot)) {
            // experience when consuming items is based on rarity, slot type and level
            expPerMaterial = upgradeMeta.rarityExpFactor[materialTemplate.rarity].exp;
            expPerMaterial *= upgradeMeta.slotExpFactor[materialSlot].expFactor;
            expPerMaterial *= upgradeMeta.levelExpFactor[materialItem.level - 1];
        } else {
            let materialExp = levelingMeta.materials.find(x => x.item == materialItem.template);
            if (materialExp) {
                expPerMaterial = materialExp.exp;
            } else {
                throw Errors.IncompatibleLevelingMaterial;
            }
        }
        
        // add experience to item for each material
        if (count > materialItem.count) {
            count = materialItem.count;
        }

        let expTable = upgradeMeta.levelExpTable;
        let expRequired = expTable[item.level - 1];
        while (maxLevel > item.level && count > 0 && expTable.length >= item.level) {
            count--;

            item.exp += expPerMaterial;
            
            this._inventory.modifyStack(materialItem, -1);

            while (expRequired <= item.exp && maxLevel > item.level) {
                item.level++;
                item.exp -= expRequired;
                expRequired = expTable[item.level - 1];
            }
        }

        this._inventory.setItemUpdated(item);

        return item.id;
    }

    async _loadRecipe(recipe) {
        return await Game.db.collection(Collections.CraftingRecipes).findOne({
            _id: recipe
        });
    }

    async _getUpgradeMeta() {
        return await Game.db.collection(Collections.Meta).findOne({
            _id: "upgrade_meta"
        });
    }

    async _getMeta() {
        return await Game.db.collection(Collections.Meta).findOne({
            _id: "meta"
        });
    }
}

module.exports = Crafting;