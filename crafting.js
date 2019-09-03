import Game from "./game";
import Errors from "./knightlands-shared/errors";

const { Collections } = require("./database");

const {
    EquipmentSlots,
    getSlot
} = require("./knightlands-shared/equipment_slot");

const ItemType = require("./knightlands-shared/item_type");

class Crafting {
    constructor(inventory) {
        this._inventory = inventory;
    }

    async upgradeItem(itemId, material, count) {
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
            expPerMaterial = upgradeMeta.rarityExpFactor[materialTemplate.rarity];
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
        while (count > 0 || expTable.length >= item.level) {
            count--;

            item.exp += expPerMaterial;

            if (expRequired <= item.exp) {
                item.level++;
                item.exp -= expRequired;
                expRequired = expTable[item.level - 1];
            }
        }

        this._inventory.setItemUpdated(item);

        return item.id;
    }

    async _getUpgradeMeta() {
        return await this._db.collection(Collections.Meta).findOne({
            _id: "upgrade_meta"
        });
    }
}

module.exports = Crafting;