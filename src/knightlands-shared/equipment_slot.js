const EquipmentType = require("./equipment_type");

const EquipmentSlots = {
    MainHand: "mainHand",
    OffHand: "offHand",
    Ring: "ring",
    Necklace: "necklace",
    Pet: "pet",
    Boots: "boots",
    Helmet: "helmet",
    Chest: "chest",
    Gloves: "gloves",
    Cape: "cape"
};

function getSlot(equipmentType) {
    switch (equipmentType) {
        case EquipmentType.Axe:
        case EquipmentType.Bow:
        case EquipmentType.Sword:
        case EquipmentType.Spear:
        case EquipmentType.Wand:
            return EquipmentSlots.MainHand;

        case EquipmentType.Scythe:
        case EquipmentType.Knive:
        case EquipmentType.Star:
        case EquipmentType.Shield:
        case EquipmentType.Whip:
            return EquipmentSlots.OffHand;

        case EquipmentType.Chest:
            return EquipmentSlots.Chest;

        case EquipmentType.Helmet:
            return EquipmentSlots.Helmet;

        case EquipmentType.Boots:
            return EquipmentSlots.Boots;

        case EquipmentType.Gloves:
            return EquipmentSlots.Gloves;

        case EquipmentType.Cape:
            return EquipmentSlots.Cape;

        case EquipmentType.Ring:
            return EquipmentSlots.Ring;

        case EquipmentType.Necklace:
            return EquipmentSlots.Necklace;

        case EquipmentType.Pet:
            return EquipmentSlots.Pet;
    }
}

module.exports = {
    EquipmentSlots,
    getSlot
}