import Game from "../game";
import Errors from "../knightlands-shared/errors";
const { Collections } = require("../database");
import CurrencyType from "../knightlands-shared/currency_type";
import Random from "../random";
import Rarity from "../knightlands-shared/rarity";
import RankingType from "../knightlands-shared/ranking_type";
import Elements from "../knightlands-shared/elements";
const {
    EquipmentSlots,
    getSlot
} = require("../knightlands-shared/equipment_slot");

const ItemType = require("../knightlands-shared/item_type");

class Crafting {
    constructor(user, inventory, equipment) {
        this._equipment = equipment;
        this._inventory = inventory;
        this._user = user;

        console.log(`create Crafting ${this._user}`)
    }

    get _userId() {
        return this._user.address;
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
        } else if (this.isAccessory(itemTemplate.equipmentType)) {
            enchantingSteps = enchantingMeta.accessory;
        } else if (!this.isArmour(itemTemplate.equipmentType)) {
            throw Errors.ItemNotEnchantable;
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
            await this._inventory.modifyCurrency(currency, -enchantCost);
        }

        this._inventory.consumeIngridients(stepData.ingridients);

        // roll success 
        if (currency == CurrencyType.Soft && Random.range(0, 100, true) > stepData.successRate) {
            return false;
        }

        return await this.enchantPayed(itemId);
    }

    isWeapon(equipmentType) {
        const equipmentSlot = getSlot(equipmentType);
        return equipmentSlot == EquipmentSlots.MainHand || equipmentSlot == EquipmentSlots.OffHand;
    }

    isAccessory(equipmentType) {
        const equipmentSlot = getSlot(equipmentType);
        return equipmentSlot == EquipmentSlots.Ring || equipmentSlot == EquipmentSlots.Necklace;
    }

    isArmour(equipmentType) {
        const equipmentSlot = getSlot(equipmentType);
        return equipmentSlot == EquipmentSlots.Boots ||
            equipmentSlot == EquipmentSlots.Cape ||
            equipmentSlot == EquipmentSlots.Chest ||
            equipmentSlot == EquipmentSlots.Gloves ||
            equipmentSlot == EquipmentSlots.Helmet;
    }

    async enchantPayed(itemId) {
        await this._user.dailyQuests.onItemEnchanted(1);

        let item = this._getItemById(itemId);
        if (item) {
            if (!item.unique) {
                item = this._inventory.makeUnique(item);
            }

            item.enchant = (item.enchant || 0) + 1;
            this._inventory.setItemUpdated(item);

            return item.id;
        }

        return false;
    }

    async _craftRecipe(recipeId, currency, amount) {
        let recipe = recipeId
        if (typeof recipeId !== "object") {
            recipe = await this._loadRecipe(recipeId);
        }

        if (!recipe) {
            throw Errors.NoRecipe;
        }

        if (!(await this._inventory.hasEnoughIngridients(recipe.ingridients))) {
            throw Errors.NoRecipeIngridients;
        }

        if (currency == CurrencyType.Fiat) {
            return await Game.craftingQueue.requestCraftingPayment(this._userId, recipe, amount);
        } else {
            // check the balance
            let recipeCost = recipe.soft;
            if (currency == CurrencyType.Hard) {
                recipeCost = recipe.hard;
            }

            recipeCost *= amount;

            if (this._inventory.getCurrency(currency) < recipeCost) {
                throw Errors.NotEnoughCurrency;
            }

            // deduct fee
            await this._inventory.modifyCurrency(currency, -recipeCost);
        }

        // consume ingridients now, even if it's fiat payment, they will be forced to pay money.
        // prevents problems when payment is delayed and ingridients are used somewhere else which leads to increased UX friction
        await this._inventory.consumeItemsFromCraftingRecipe(recipe, amount);

        return recipe;
    }

    // check pre-conditions, ask for payment if necessary
    async craftRecipe(recipeId, currency, amount) {
        const recipe = await this._craftRecipe(recipeId, currency, amount);
        return await this.craftPayedRecipe(recipe, amount);
    }

    // just craft as final step
    async craftPayedRecipe(recipe, amount, element) {
        if (typeof recipe != "object") {
            recipe = await this._loadRecipe(recipe);
        }

        const template = await Game.itemTemplates.getTemplate(recipe.resultItem);
        await Game.rankings.updateRank(this._userId, {
            type: RankingType.CraftedItemsByRarity,
            rarity: template.rarity
        }, amount);

        await this._inventory.autoCommitChanges(async inv => {
            await inv.addItemTemplate(recipe.resultItem, amount, element);
        });

        return {
            recipe,
            amount
        };
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

            if (materialItem.equipped) {
                throw Errors.ItemEquipped;
            }

            // if item is not equipped and item is not yet unique
            // if it same item as target - make sure it has enough stack size for material count + unique
            if (!item.equipped && !item.unique && materialItem.id == item.id && materialItem.count < items[i] + 1) {
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

    async levelUpItem(itemId, materials, count) {
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
        const oldLevel = item.level;
        let exp = item.exp;
        const materialsConsumed = {};

        try {
            for (let i = 0; i < materials.length; ++i) {
                const material = materials[i];

                // check if material item can be used as leveling material 
                let materialItem = this._inventory.getItemById(material);
                if (!materialItem) {
                    throw Errors.NoMaterial;
                }

                // if material type is item itself
                if (itemId === material && item.unique) {
                    throw Errors.IncorrectArguments;
                }

                if (materialItem.equipped) {
                    throw Errors.ItemEquipped;
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
                while (maxLevel > level && itemsToConsume > 0) {
                    exp += expPerMaterial;
                    itemsToConsume--;
                    while (exp >= expRequired && maxLevel > level) {
                        level++;
                        exp -= expRequired;
                        expRequired = expTable[level - 1];
                    }
                }

                materialsConsumed[materialItem.id] = count - itemsToConsume;

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
            const materialId = materials[i];
            const material = this._inventory.getItemById(materialId);
            if (material) {
                this._inventory.modifyStack(material, -materialsConsumed[materialId]);
            }
        }

        const levelsGained = level - oldLevel;
        await this._user.dailyQuests.onItemLeveled(levelsGained);
        await Game.rankings.updateRank(this._userId, {
            type: RankingType.LevelItemsByRarity,
            rarity: itemTemplate.rarity
        }, levelsGained);

        return item.id;
    }

    async disenchantConvert(conversions) {
        const disMeta = await this._getDisenchantingMeta();

        const itemIds = Object.keys(conversions);
        const inventoryItems = await this._user.inventory.getItemById(itemIds);
        const templates = await Game.itemTemplates.getTemplates(inventoryItems.map(x => x.template), true);

        const materials = {};
        const itemsToRemove = {};

        let index = 0;
        const length = inventoryItems.length;

        for (; index < length; ++index) {
            const item = inventoryItems[index];
            if (item.equipped) {
                throw Errors.ItemEquipped;
            }

            const template = templates[item.template];

            const disRarityMeta = disMeta[template.rarity];
            if (!disRarityMeta) {
                throw Errors.IncorrectArguments;
            }

            if (item.template != disRarityMeta.dustItem) {
                throw Errors.IncorrectArguments;
            }

            const toConvert = parseInt(conversions[item.id]);
            if (!toConvert || isNaN(toConvert)) {
                throw Errors.IncorrectArguments;
            }

            itemsToRemove[item.id] = itemsToRemove[item.id] || {
                item,
                count: 0
            };
            itemsToRemove[item.id].count += toConvert * disRarityMeta.upgradeCost;

            let nextRarity = Rarity.Rare;
            switch (template.rarity) {
                case Rarity.Rare:
                    nextRarity = Rarity.Epic;
                    break;

                case Rarity.Epic:
                    nextRarity = Rarity.Legendary;
                    break;
            }

            const nextDisRarityMeta = disMeta[nextRarity];
            if (!nextDisRarityMeta) {
                throw Errors.IncorrectArguments;
            }

            materials[nextDisRarityMeta.dustItem] = materials[nextDisRarityMeta.dustItem] || {
                item: nextDisRarityMeta.dustItem,
                quantity: 0
            };

            materials[nextDisRarityMeta.dustItem].quantity += toConvert;
        }

        const materialItems = Object.values(materials);
        await this._user.inventory.addItemTemplates(materialItems);
        this._user.inventory.removeItems(Object.values(itemsToRemove));

        return materialItems;
    }

    async disenchantItems(items) {
        const disMeta = await this._getDisenchantingMeta();

        // verify and count resulting materials
        const itemIds = Object.keys(items);
        const inventoryItems = await this._user.inventory.getItemById(itemIds);

        const templates = await Game.itemTemplates.getTemplates(inventoryItems.map(x => x.template), true);
        const materials = {};
        const itemsToRemove = {};

        let index = 0;
        const length = inventoryItems.length;

        for (; index < length; ++index) {
            const item = inventoryItems[index];
            if (item.equipped) {
                throw Errors.ItemEquipped;
            }

            if (!items[item.id]) {
                throw Errors.NoItem;
            }

            const itemsToDisenchant = parseInt(items[item.id]);

            itemsToRemove[item.id] = itemsToRemove[item.id] || {
                item,
                count: 0
            };
            itemsToRemove[item.id].count += itemsToDisenchant;

            if (item.count < itemsToRemove[item.id].count) {
                throw Errors.NoEnoughItems;
            }

            const template = templates[item.template];
            if (template.type != ItemType.Equipment || template.equipmentType == EquipmentSlots.Pet) {
                throw Errors.IncorrectArguments;
            }

            const disRarityMeta = disMeta[template.rarity];
            if (!disRarityMeta) {
                throw Errors.IncorrectArguments;
            }

            materials[disRarityMeta.dustItem] = materials[disRarityMeta.dustItem] || {
                item: disRarityMeta.dustItem,
                rarity: template.rarity,
                quantity: 0
            };

            materials[disRarityMeta.dustItem].quantity += disRarityMeta.dropAmountMin * itemsToDisenchant;
        }

        const materialItems = Object.values(materials);
        await this._user.inventory.addItemTemplates(materialItems);
        this._user.inventory.removeItems(Object.values(itemsToRemove));

        for (const material of materialItems) {
            await Game.rankings.updateRank(this._userId, {
                type: RankingType.DisenchantedItemsByRarity,
                rarity: material.rarity
            }, material.quantity);
        }

        return materialItems;
    }

    async createWeapon(recipeId, currency, itemId, element) {
        const createMeta = await Game.db.collection(Collections.Meta).findOne({ _id: "elemental_weapons" });

        let elementalCreation = createMeta.new[recipeId];
        if (!elementalCreation) {
            throw Errors.IncorrectArguments;
        }

        const item = this._inventory.getItemById(itemId);
        if ((item.element && item.element == Elements.Physical) || !this._inventory.isMaxLevel(item)) {
            throw Errors.IncorrectArguments;
        }

        if (!elementalCreation.baseItems.includes(item.template)) {
            throw Errors.IncorrectArguments;
        }

        await this._craftRecipe(elementalCreation.recipe, currency, 1);
        
        await Game.rankings.updateRank(this._userId, {
            type: RankingType.CraftedItemsByRarity,
            rarity: item.rarity
        }, 1);

        const newItem = this._inventory.copyItem(item, 1);
        newItem.element = element;

        await this._inventory.autoCommitChanges(async inv => {
            inv.removeItem(itemId)
            inv.addItem(newItem);
        });

        return {
            item: newItem
        };
    }

    _getItemById(itemId) {
        return this._inventory.getItemById(itemId);
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

    async _getDisenchantingMeta() {
        return await Game.db.collection(Collections.Meta).findOne({
            _id: "disenchanting_meta"
        });
    }

    async _getMeta() {
        return await Game.db.collection(Collections.Meta).findOne({
            _id: "meta"
        });
    }
}

module.exports = Crafting;
