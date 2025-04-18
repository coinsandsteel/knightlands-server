import Game from "../game";
import Errors from "../knightlands-shared/errors";
import AccessoryOption from "../knightlands-shared/accessory_option";
const { Collections } = require("../database/database");
import CurrencyType from "../knightlands-shared/currency_type";
import Random from "../random";
import Rarity from "../knightlands-shared/rarity";
import RankingType from "../knightlands-shared/ranking_type";
import Elements from "../knightlands-shared/elements";
import WeightedList from "../js-weighted-list";
const {
    EquipmentSlots,
    getSlot
} = require("../knightlands-shared/equipment_slot");

const { ItemType } = require("../knightlands-shared/item_type");
const ROLLBACK_LEVEL = 5;

class Crafting {
    constructor(user, inventory) {
        this._inventory = inventory;
        this._user = user;
    }

    get _userId() {
        return this._user.id;
    }

    get _userAddress() {
        return this._user.address;
    }

    async rollbackRerollAccessory(itemId) {
        const item = this._inventory.getItemById(itemId);
        if (!item) {
            throw Errors.IncorrectArguments;
        }

        if (item.locked) {
            throw Errors.ItemLocked;
        }

        let baseTemplate = await Game.itemTemplates.getTemplate(item.template);
        if (!baseTemplate) {
            throw Errors.NoTemplate;
        }

        if (baseTemplate.type != ItemType.Equipment || !this.isAccessory(baseTemplate.equipmentType)) {
            throw Errors.IncorrectArguments;
        }

        const length = item.properties.length;
        for (let i = 0; i < length; ++i) {
            const prop = item.properties[i];
            if (!prop.prevValue) {
                break;
            }

            prop.value = prop.prevValue;
            prop.prevValue = null;
        }

        this._inventory.setItemUpdated(item);
    }

    async rerollAccessory(itemId) {
        const item = this._inventory.getItemById(itemId);
        if (!item) {
            throw Errors.IncorrectArguments;
        }

        if (item.locked) {
            throw Errors.ItemLocked;
        }

        let baseTemplate = await Game.itemTemplates.getTemplate(item.template);
        if (!baseTemplate) {
            throw Errors.NoTemplate;
        }

        if (baseTemplate.type != ItemType.Equipment || !this.isAccessory(baseTemplate.equipmentType)) {
            throw Errors.IncorrectArguments;
        }

        const rarity = item.rarity;
        const accCraftMeta = await this._getAccessoryMeta();
        const priceMeta = accCraftMeta.reroll[rarity];
        const rerolls = item.rerolls || 1;
        const price = Math.floor(Math.pow(rerolls, priceMeta.base) * priceMeta.scale);

        if (price > this._user.softCurrency) {
            throw Errors.NotEnoughCurrency;
        }

        if (!this._user.inventory.hasItems(priceMeta.shardItem, priceMeta.shards)) {
            throw Errors.NoItem;
        }

        this._user.inventory.removeItemByTemplate(priceMeta.shardItem, priceMeta.shards);

        const isRing = getSlot(baseTemplate.equipmentType) == EquipmentSlots.Ring;
        const meta = isRing ? accCraftMeta.ring : accCraftMeta.necklace;
        await this._rerollAccessoryOptions(meta, item);

        await this._user.addSoftCurrency(-price);
        item.rerolls = rerolls + 1;
        this._inventory.setItemUpdated(item);
    }

    async createAccessory(baseTemplateId, amount) {
        if (isNaN(amount) || amount < 0) {
            throw Errors.IncorrectArguments;
        }

        let baseTemplate = await Game.itemTemplates.getTemplate(baseTemplateId);
        if (!baseTemplate) {
            throw Errors.NoTemplate;
        }

        if (baseTemplate.type != ItemType.Equipment || !this.isAccessory(baseTemplate.equipmentType)) {
            throw Errors.IncorrectArguments;
        }

        const accCraftMeta = await this._getAccessoryMeta();
        if (amount > accCraftMeta.maxCraft) {
            throw Errors.IncorrectArguments;
        }

        const isRing = getSlot(baseTemplate.equipmentType) == EquipmentSlots.Ring;

        // check if item is part of templates for crafting
        const rarity = baseTemplate.rarity;
        const meta = isRing ? accCraftMeta.ring : accCraftMeta.necklace;
        if (meta.items[rarity].items.findIndex(x => x == baseTemplate._id) === -1) {
            throw Errors.IncorrectArguments;
        }

        const recipe = accCraftMeta.recipes[rarity];
        const price = Game.currencyConversionService.convertToNative(CurrencyType.Dkt, recipe.price);

        if (price > this._inventory.getCurrency(CurrencyType.Dkt)) {
            throw Errors.NotEnoughCurrency;
        }

        if (!this._inventory.hasItems(recipe.resource, recipe.resourceCount * amount)) {
            throw Errors.NotEnoughResource;
        }

        this._inventory.removeItemByTemplate(recipe.resource, recipe.resourceCount * amount);
        await this._inventory.modifyCurrency(CurrencyType.Dkt, -price);

        await Game.rankings.updateRank(this._user.id, {
            type: RankingType.CraftedItemsByRarity,
            rarity: rarity
        }, amount);

        let items = new Array(amount);
        while (amount-- > 0) {
            const item = this._inventory.createItemByTemplate(baseTemplate);
            item.rerolls = 1;
            item.unique = true;
            item.properties = this._generateAccessoryOptions(meta.options[rarity], recipe.optionsCount);
            items[amount] = this._inventory.addItem(item, true);
        }

        return items;
    }

    async _rerollAccessoryOptions(meta, item) {
        const length = item.properties.length;
        for (let i = 0; i < length; ++i) {
            const prop = item.properties[i];
            const rangeMeta = meta.reroll[prop.id];
            const range = rangeMeta[prop.rarity];
            prop.prevValue = prop.value;
            prop.value = this._randomValue(range.minValue, range.maxValue, prop.r || true)
        }
    }

    _randomValue(min, max, relative) {
        return relative ? Random.range(min, max, true) : Random.intRange(min, max, true);
    }

    _generateAccessoryOptions(optionsMeta, count) {
        const templates = new WeightedList(optionsMeta).shuffle()
        const length = templates.length;
        const properties = new Array(count);
        let typesRolled = 0
        const pickedTypes = {}
        for (let i = 0; i < length; ++i) {
            const template = templates[i].data;
            if (pickedTypes[template.type]) {
                continue;
            }

            pickedTypes[template.type] = true;

            let relative = true;
            const property = {
                value: 0,
                prevValue: null,
                id: template.id,
                rarity: template.rarity
            };

            switch (template.type) {
                case AccessoryOption.GoldOnHitInRaid:
                case AccessoryOption.ExpOnHitInRaid:
                    relative = false;
                    break;

                case AccessoryOption.DropItemInQuest:
                case AccessoryOption.DropItemInRaid:
                case AccessoryOption.DropUnitShard:
                    property.itemId = template.itemId;
                    break;

                case AccessoryOption.IncreasedStat:
                    property.stat = template.stat;
                    break;

                case AccessoryOption.RewardsTrial:
                    property.trialType = template.trialType;
                    break;

                case AccessoryOption.ArmyDamageInRaidElement:
                    property.element = template.element;
                    break;
            }

            property.value = this._randomValue(template.minValue, template.maxValue, relative);
            property.r = relative;

            properties[typesRolled] = property;
            typesRolled++;

            if (typesRolled == count) {
                break;
            }
        }
        return properties;
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

        if (itemTemplate.type != ItemType.Equipment || !itemTemplate.enchantable) {
            throw Errors.ItemNotEnchantable;
        }

        let enchantingInProcess = await Game.craftingQueue.isEnchantingInProcess(this._userAddress, itemId);
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

        let enchantCost = stepData.soft;
        if (stepData.hard > 0) {
            currency = CurrencyType.Dkt;
            enchantCost = Game.currencyConversionService.convertToNative(CurrencyType.Dkt, stepData.hard);
        }

        if (this._inventory.getCurrency(currency) < enchantCost) {
            throw Errors.NotEnoughCurrency;
        }

        // deduct fee
        await this._inventory.modifyCurrency(currency, -enchantCost);

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
            return await Game.craftingQueue.requestCraftingPayment(this._userAddress, recipe, amount);
        } else {
            // check the balance
            let recipeCost = recipe.soft;
            currency = CurrencyType.Soft;

            if (recipe.hard) {
                currency = CurrencyType.Dkt;
                recipeCost = Game.currencyConversionService.convertToNative(CurrencyType.Dkt, recipe.hard);
            }

            if (recipe.ashFee) {
                currency = CurrencyType.Dkt;
                recipeCost = Game.currencyConversionService.convertToNative(CurrencyType.Dkt, recipe.ashFee);
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
        await Game.rankings.updateRank(this._user.id, {
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

        if (item.breakLimit == 2) {
            throw Errors.MaxUnbind;
        }

        let itemTemplate = await Game.itemTemplates.getTemplate(item.template);
        if (!itemTemplate) {
            throw Errors.NoTemplate;
        }

        if (!itemTemplate.unbindable) {
            throw Errors.IncorrectArguments;
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

            if (materialItem.locked) {
                throw Errors.ItemLocked;
            }

            // if item is not equipped and item is not yet unique
            // if it same item as target - make sure it has enough stack size for material count + unique
            if (!item.equipped && !item.unique && materialItem.id == item.id && materialItem.count < items[i] + 1) {
                throw Errors.NotEnoughMaterial;
            }

            if (materialItem.template != item.template) {
                throw Errors.IncorrectArguments;
            }

            if (materialItem.rarity != item.rarity) {
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

    async levelUpItem(itemId, materials) {
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

        let holderLevel = this._user.level;
        // if item is equipped - do not allow to level it above the holder
        if (item.equipped) {
            if (item.holder != -1) {
                const unit = await Game.armyManager.getUnit(this._userId, item.holder);
                if (unit) {
                    holderLevel = unit.level;
                }
            }
        }

        let maxLevel = Math.min(meta.itemLimitBreaks[item.rarity][item.breakLimit], Math.floor(holderLevel));
        if (item.level >= maxLevel) {
            throw Errors.ItemMaxLevel;
        }

        let level = item.level;
        const oldLevel = item.level;
        let exp = item.exp;

        try {
            for (const material in materials) {
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

                if (materialItem.locked) {
                    throw Errors.ItemLocked;
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

                let totalMaterial = materialItem.count;
                if (materialItem.id == item.id) {
                    // item is not yet unique, reserve 1 for it
                    totalMaterial--;
                }

                let itemsToConsume = +materials[material];

                if (totalMaterial < itemsToConsume) {
                    throw Errors.NotEnoughMaterial;
                }
                // add experience to item for each material

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

                materials[material] -= itemsToConsume;

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

        for (let materialId in materials) {
            const material = this._inventory.getItemById(materialId);
            if (material) {
                this._inventory.modifyStack(material, -materials[materialId]);
            }
        }

        const levelsGained = level - oldLevel;
        await this._user.dailyQuests.onItemLeveled(levelsGained);
        await Game.rankings.updateRank(this._user.id, {
            type: RankingType.LevelItemsByRarity,
            rarity: itemTemplate.rarity
        }, levelsGained);

        return item.id;
    }

    async convert(conversions, entity) {
        let metaId = null;
        switch (entity) {
            case 'dust':
                {
                    metaId = "disenchanting_meta";
                    break;
                }
            case 'shard':
                {
                    metaId = "acc_shards_meta";
                    break;
                }
        }

        if (!metaId) {
            throw Errors.IncorrectArguments;
        }
        const meta = await this._getConvertMeta(metaId);

        const itemIds = Object.keys(conversions);
        const inventoryItems = this._user.inventory.getItemById(itemIds);
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
            if (item.locked) {
                throw Errors.ItemLocked;
            }

            const template = templates[item.template];
            const rarityMeta = meta[template.rarity];
            if (!rarityMeta) {
                throw Errors.IncorrectArguments;
            }
            if (item.template != rarityMeta.itemId) {
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
            itemsToRemove[item.id].count += toConvert * rarityMeta.upgradeCost;

            let nextRarity = Rarity.Rare;
            switch (template.rarity) {
                case Rarity.Rare:
                    nextRarity = Rarity.Epic;
                    break;

                case Rarity.Epic:
                    nextRarity = Rarity.Legendary;
                    break;

                case Rarity.Legendary:
                    nextRarity = Rarity.Mythical;
                    break;
            }

            const nextRarityMeta = meta[nextRarity];
            if (!nextRarityMeta) {
                throw Errors.IncorrectArguments;
            }

            materials[nextRarityMeta.itemId] = materials[nextRarityMeta.itemId] || {
                item: nextRarityMeta.itemId,
                quantity: 0
            };

            materials[nextRarityMeta.itemId].quantity += toConvert;
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

            if (item.locked) {
                throw Errors.ItemLocked;
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

            const rarityMeta = disMeta[template.rarity];
            if (!rarityMeta) {
                throw Errors.IncorrectArguments;
            }

            materials[rarityMeta.itemId] = materials[rarityMeta.itemId] || {
                item: rarityMeta.itemId,
                rarity: template.rarity,
                quantity: 0
            };

            materials[rarityMeta.itemId].quantity += rarityMeta.dropAmountMin * itemsToDisenchant;
        }

        const materialItems = Object.values(materials);
        await this._user.inventory.addItemTemplates(materialItems);
        this._user.inventory.removeItems(Object.values(itemsToRemove));

        for (const material of materialItems) {
            await this._user.dailyQuests.onItemDisenchant(material.quantity);
            await Game.rankings.updateRank(this._user.id, {
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

        if (item.equipped) {
            throw Errors.ItemEquipped;
        }

        if (!item.element || item.element != Elements.Physical || !this._inventory.isMaxLevel(item)) {
            throw Errors.IncorrectArguments;
        }

        if (!elementalCreation.baseItems.includes(item.template)) {
            throw Errors.IncorrectArguments;
        }

        await this._craftRecipe(elementalCreation.recipe, currency, 1);

        await Game.rankings.updateRank(this._user.id, {
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

    async evolve(itemId, extraItemId) {
        const evolveMeta = await Game.db.collection(Collections.Meta).findOne({ _id: "evolve" });
        const item = this._inventory.getItemById(itemId);
        if (!item) {
            throw Errors.NoItem;
        }

        const template = await Game.itemTemplates.getTemplate(item.template);
        if (!template || this.isAccessory(template.equipmentType)) {
            throw Errors.IncorrectArguments;
        }

        const evolveRecipe = evolveMeta.evolveRecipes.find(x => x.fromRarity == item.rarity);
        if (!evolveRecipe) {
            throw Errors.IncorrectArguments;
        }

        if (!this._inventory.isMaxLevel(item)) {
            throw Errors.NotMaxLevel;
        }

        const nextTemplate = evolveMeta.templates[item.template];
        if (!nextTemplate) {
            throw Errors.IncorrectArguments;
        }

        let meta = await this._getMeta();
        if (item.breakLimit != 2 || item.level != meta.itemLimitBreaks[item.rarity][item.breakLimit]) {
            throw Errors.IncorrectArguments;
        }

        if (item.element && item.element != Elements.Physical) {
            const extraItem = this._inventory.getItemById(extraItemId);
            if (!extraItem || extraItem.equipped) {
                throw Errors.NoItem;
            }

            if (extraItem.locked) {
                throw Errors.ItemLocked;
            }

            if (extraItem.template != nextTemplate) {
                throw Errors.IncorrectArguments;
            }

            if (extraItem.element != Elements.Physical || extraItem.breakLimit != 2) {
                throw Errors.IncorrectArguments;
            }

            if (extraItem.level != meta.itemLimitBreaks[extraItem.rarity][extraItem.breakLimit]) {
                throw Errors.IncorrectArguments;
            }
        }

        await this._craftRecipe(evolveRecipe.recipe, CurrencyType.Soft, 1);

        if (extraItemId) {
            this._inventory.removeItem(extraItemId);
        }

        let nextRarity = item.rarity;
        switch (nextRarity) {
            case Rarity.Common:
                nextRarity = Rarity.Rare;
                break;

            case Rarity.Rare:
                nextRarity = Rarity.Epic;
                break;

            case Rarity.Epic:
                nextRarity = Rarity.Legendary;
                break;

            case Rarity.Legendary:
                nextRarity = Rarity.Mythical;
                break;
        }

        item.rarity = nextRarity;
        item.breakLimit = 0;
        item.template = nextTemplate;
        item.enchant = 0;

        await this._inventory.autoCommitChanges(async inv => {
            inv.setItemUpdated(item);
        });

        return {
            item: item
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

    async _getConvertMeta(_id) {
        return await Game.db.collection(Collections.Meta).findOne({ _id });
    }

    async _getMeta() {
        return await Game.db.collection(Collections.Meta).findOne({
            _id: "meta"
        });
    }

    async _getDisenchantingMeta() {
        return await Game.db.collection(Collections.Meta).findOne({
            _id: "disenchanting_meta"
        });
    }

    async _getAccessoryMeta() {
        return await Game.db.collection(Collections.Meta).findOne({ _id: "craft_accessories" });
    }
}

module.exports = Crafting;