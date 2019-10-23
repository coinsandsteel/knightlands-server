import Game from "../game";
import Errors from "../knightlands-shared/errors";
const { Collections } = require("../database");
import CurrencyType from "../knightlands-shared/currency_type";
import Random from "./../random";

const {
    EquipmentSlots,
    getSlot
} = require("../knightlands-shared/equipment_slot");

const ItemType = require("../knightlands-shared/item_type");

class Crafting {
    constructor(userId, inventory, equipment) {
        this._equipment = equipment;
        this._inventory = inventory;
        this._userId = userId;
    }

    async enchantItem(itemId, currency) {
        itemId *= 1;

        let item = this._getItemById(itemId);
        if (!item) {
            throw Errors.NoItem;
        }

        let itemTemplate = await Game.itemTemplates.getTemplate(item.template);
        if (!itemTemplate) {
            throw Errors.NoTemplate;
        }

        if (itemTemplate.type != ItemType.Equipment || itemTemplate.enchantable) {
            throw Errors.ItemNotEnchantable;
        }

        let enchantingInProcess = await Game.craftingQueue.isEnchantingInProcess(this._userId, itemId);
        if (enchantingInProcess) {
            throw Errors.EnchantingInProcess;
        }

        let enchantingMeta = await Game.db.collection(Collections.Meta).findOne({ _id: "enchanting_meta" });
        let enchantLevel = item.enchant || 0;

        if (enchantLevel >= enchantingMeta.maxEnchanting) {
            throw Errors.MaxEnchantLevel;
        }
        
        let enchantingSteps = enchantingMeta.armour;
        if (this.isWeapon(itemTemplate.equipmentType)) {
            enchantingSteps = enchantingMeta.weapon;
        }
        
        let stepData = enchantingSteps[itemTemplate.rarity].steps[enchantLevel];

        if (!(await this._inventory.hasEnoughIngridients(stepData.ingridients))) {
            throw Errors.NoRecipeIngridients;
        }

        if (currency == CurrencyType.Fiat) {
            if (!stepData.iap) {
                throw Errors.UknownIAP;
            }

            return await Game.craftingQueue.requestEnchantingPayment(this._userId, stepData.iap, item);
        } else {
            // check the balance
            let enchantCost = stepData.soft;
            if (currency == CurrencyType.Hard) {
                enchantCost = stepData.hard;
            }

            if (this._inventory.getCurrency(currency) < enchantCost) {
                throw Errors.NotEnoughCurrency;
            }

            // deduct fee
            this._inventory.modifyCurrency(currency, -enchantCost);
        }

        this._inventory.consumeIngridients(stepData.ingridients);

        // roll success 
        if (Random.range(0, 100, true) > stepData.successRate) {
            return false;
        }

        return await this.enchantPayed(itemId);
    }

    isWeapon(equipmentType) {
        const equipmentSlot = getSlot(equipmentType);
        return equipmentSlot == EquipmentSlots.MainHand || equipmentSlot == EquipmentSlots.OffHand;
    }

    async enchantPayed(itemId) {
        return await this._inventory.autoCommitChanges(inventory => {
            let item = this._getItemById(itemId);
            if (item) {
                if (!item.unique) {
                    item = inventory.makeUnique(item);
                }

                item.enchant = (item.enchant || 0) + 1;
                inventory.setItemUpdated(item);

                return item.id;
            }

            return false;
        });
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

        return await this.craftPayedRecipe(recipe);
    }

    // just craft as final step
    async craftPayedRecipe(recipe) {
        if (typeof recipe != "object") {
            recipe = await this._loadRecipe(recipe);
        }

        await this._inventory.autoCommitChanges(async inv => {
            await inv.addItemTemplate(recipe.resultItem);
        });

        return recipe;
    }

    async unbindItem(itemId, items) {
        itemId *= 1;

        await this._inventory.loadAllItems();

        let item = this._getItemById(itemId);
        if (!item) {
            throw Errors.NoItem;
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

            // if it same item as target - make sure it has enough stack size for material count + unique item
            if (materialItem.count < items[i]+1) {
                throw Errors.NotEnoughMaterial;
            }

            if (materialItem.template != item.template) {
                throw Errors.IncorrectArguments;
            }

            unbindLevels += items[i] * 1;
        }

        if (unbindLevels < 1 && unbindLevels > 2) {
            throw Errors.IncorrectArguments;
        }

        // if item is not unique - it should be converted to unique and assigned new id to make it stand out from default stack
        if (!item.unique) {
            item = this._inventory.makeUnique(item);
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

    async upgradeItem(itemId, materials, count) {
        itemId *= 1;

        if (!Number.isInteger(count) || count < 1) {
            console.log(count);
            throw Errors.IncorrectArguments;
        }

        if (materials.length > 1) {
            count = 1;
        }

        await this._inventory.loadAllItems();

        let item = this._getItemById(itemId);
        if (!item) {
            throw Errors.NoItem;
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

        let level = item.level;
        let exp = item.exp;

        try {
            for (let i = 0; i < materials.length; ++i) {
                const material = materials[i];

                // if material type is item itself
                if (itemId === material) {
                    console.log(itemId, material);
                    throw Errors.IncorrectArguments;
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

                let itemsToConsume = count;
                let totalmaterial = materialItem.count;
                if (materialItem.id == item.id) {
                    // item is not yet unique, reserve 1 for it
                    totalmaterial--;
                }
                // add experience to item for each material
                if (itemsToConsume > totalmaterial) {
                    itemsToConsume = totalmaterial;
                }

                let expTable = upgradeMeta.levelExpTable;
                let expRequired = expTable[level - 1];
                exp += expPerMaterial * itemsToConsume;
                while (expRequired <= exp && maxLevel > level) {
                    level++;
                    exp -= expRequired;
                    expRequired = expTable[level - 1];
                }

                if (level == maxLevel) {
                    exp = 0;
                }
            }
        } catch (exc) {
            throw exc;
        }

        // if item is not unique - it should be converted to unique and assigned new id to make it stand out from default stack
        if (!item.unique) {
            item = this._inventory.makeUnique(item);
        }

        item.level = level;
        item.exp = Math.round(exp);
        
        this._inventory.setItemUpdated(item);

        for (let i = 0; i < materials.length; ++i) {
            const material = materials[i];
            this._inventory.modifyStack(this._inventory.getItemById(material), -count);
        }

        return item.id;
    }

    _getItemById(itemId) {
        let item = this._inventory.getItemById(itemId);
        if (!item || item.equipped) {
            // try to search in equipment
            for (const slot in this._equipment) {
                const gear = this._equipment[slot];
                if (gear.id == itemId) {
                    item = gear;
                    break;
                }
            }
        }

        return item;
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