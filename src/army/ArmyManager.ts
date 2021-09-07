import Game from "../game";
import { Db, Collection, ReturnDocument } from "mongodb";
import { Collections } from "../database/database";
import { Lock } from "../utils/lock";
import { ArmyMeta, UnitsMeta, UnitAbilitiesMeta, ArmyUnit, UnitMeta, ArmySummonMeta } from "./ArmyTypes";
import Errors from "../knightlands-shared/errors";
import ItemStatResolver from "../knightlands-shared/item_stat_resolver";
import ArmyResolver from "../knightlands-shared/army_resolver";
import { ArmySummoner } from "./ArmySummoner";
import { ArmyLegions } from "./ArmyLegions";
import { ArmyUnits } from "./ArmyUnits";
import { ArmyCombatLegion } from "./ArmyCombatLegion";
import Events from "../knightlands-shared/events";
import SummonType from "../knightlands-shared/army_summon_type";
import ItemType from "../knightlands-shared/item_type";
import Random from "../random";
import { isNumber } from "../validation";
import { getSlot } from "../knightlands-shared/equipment_slot";
import CurrencyType from "../knightlands-shared/currency_type";

const NO_LEGION = -1;

export class ArmyManager {
    private _db: Db;
    private _units: ArmyUnits;
    private _unitTemplates: { [key: string]: UnitMeta }
    private _lock: Lock;
    private _meta: ArmyMeta;
    private _summonMeta: ArmySummonMeta;
    private _troops: UnitsMeta;
    private _generals: UnitsMeta;
    private _abilities: UnitAbilitiesMeta;
    private _armiesCollection: Collection;
    private _summoner: ArmySummoner;
    private _armyResolver: ArmyResolver;
    private _legions: ArmyLegions;
    private _combatLegions: { [key: string]: { [key: number]: ArmyCombatLegion } };
    private PaymentTag = "ArmySummonTag";

    constructor(db: Db) {
        this._db = db;
        this._lock = new Lock();
        this._summoner = new ArmySummoner(db);
        this._units = new ArmyUnits(db);
        this._legions = new ArmyLegions(db);

        // keep army in separated collection
        this._armiesCollection = this._db.collection(Collections.Armies);
    }

    async init() {
        console.log("Initializing army manager...");

        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "army" }) as ArmyMeta;
        this._generals = await this._db.collection(Collections.Meta).findOne({ _id: "generals" }) as UnitsMeta;
        this._troops = await this._db.collection(Collections.Meta).findOne({ _id: "troops" }) as UnitsMeta;
        this._abilities = await this._db.collection(Collections.Meta).findOne({ _id: "army_abilities" }) as UnitAbilitiesMeta;
        this._unitTemplates = (await this._db.collection(Collections.Meta).findOne({ _id: "army_units" })).units;

        this._summonMeta = await this._db.collection(Collections.Meta).findOne({ _id: "army_summon_meta" }) as ArmySummonMeta

        await this._summoner.init();

        const genericMeta = await this._db.collection(Collections.Meta).findOne({
            _id: "meta"
        });

        this._armyResolver = new ArmyResolver(
            this._abilities,
            new ItemStatResolver(
                genericMeta.statConversions,
                genericMeta.itemPower,
                genericMeta.itemPowerSlotFactors,
                genericMeta.charmItemPower
            ),
            this._unitTemplates,
            this._troops,
            this._generals,
            {
                level: this._meta.damageBonusPerLevel,
                rarity: this._meta.damageBonusPerRarity,
                enchant: this._meta.damageBonusPerEnchantLevel
            },
            Random.range
        );
    }

    async getUnit(userId: string, id: number) {
        let units = await this._units.getUserUnit(userId, id);
        if (!units) {
            return null;
        }
        return units[id];
    }

    async updateUnit(userId, unit: ArmyUnit) {
        return this._units.onUnitUpdated(userId, unit);
    }

    async getSummonStatus(userId) {
        return Game.paymentProcessor.fetchPaymentStatus(userId, this.PaymentTag, {});
    }

    async getArmyPreview(userId: string) {
        const army = await this._armiesCollection.findOne(
            { _id: userId },
            { projection: { legions: 1, units: 1 } }
        )

        if (!army) {
            return null;
        }

        army.legions = [army.legions[0]]

        const lookup = {};
        const legion = army.legions[0];
        for (const slotId in legion.units) {
            lookup[legion.units[slotId]] = true;
        }
        army.units = army.units.filter(x => lookup[x.id])

        return army;
    }

    async getArmy(userId: string) {
        return this._loadArmy(userId);
    }

    async setLegionSlot(userId: string, userLevel: number, legionIndex: number, slotId: number, unitId: number) {
        const legion = await this._loadLegion(userId, legionIndex);

        let unit;

        const prevUnitId = legion.units[slotId];
        const prevUnitRecord = await this._units.getUserUnit(userId, prevUnitId);

        if (prevUnitRecord) {
            // empty slot
            unit = prevUnitRecord[prevUnitId];
            if (unit) {
                unit.legion = NO_LEGION;
                await this._units.onUnitUpdated(userId, unit);
            }
        }

        delete legion.units[slotId];

        if (unitId) {
            const slot = this._meta.slots.find(x => x.id == slotId);
            if (!slot) {
                throw Errors.IncorrectArguments;
            }

            const unitRecord = (await this._units.getUserUnit(userId, unitId))[unitId];
            if (!unitRecord || unitRecord.troop != slot.troop || unitRecord.legion != NO_LEGION) {
                throw Errors.IncorrectArguments;
            }

            if (slot.levelRequired > userLevel) {
                throw Errors.IncorrectArguments;
            }

            // can't set same unit template, except if previous unit is same template
            if (!prevUnitRecord || unitRecord.template != prevUnitRecord[prevUnitId].template) {
                let ids = [];
                for (const slotId in legion.units) {
                    ids.push(legion.units[slotId]);
                }
                const usedUnits = await this._units.getUserUnits(userId, ids);
                for (const id in usedUnits) {
                    if (usedUnits[id].template == unitRecord.template) {
                        throw Errors.IncorrectArguments;
                    }
                }
            }

            // can't set same unit in multiple slots
            for (const slotId in legion.units) {
                if (legion.units[slotId] == unitId) {
                    throw Errors.IncorrectArguments;
                }
            }

            legion.units[slotId] = unitId;
            unit = unitRecord;
            unit.legion = legionIndex;
        }

        if (unit) {
            await this._units.onUnitUpdated(userId, unit);
        }

        await this._legions.onLegionUpdated(userId, legion);
    }

    async getSummonOverview(userId: string) {
        return this._loadArmyProfile(userId);
    }

    async summonRandomUnit(userId: string, count: number, stars: number, summonType: number) {
        const armyProfile = await this._loadArmyProfile(userId);

        await this._checkFreeSlots(armyProfile, 1);

        let lastUnitId = armyProfile.lastUnitId;
        const newUnits = await this._summoner.summonWithStars(count, stars, summonType);
        // assign ids
        for (const unit of newUnits) {
            unit.id = ++lastUnitId;
        }

        await this._units.addUnits(userId, newUnits, lastUnitId);
        this._units.resetCache(userId);
        return newUnits;
    }

    async summontUnits(userId: string, count: number, summonType: number, iapIndex: number) {
        let armyProfile = await this._loadArmyProfile(userId);
        await this._checkFreeSlots(armyProfile, count);

        let summonMeta = summonType == SummonType.Normal ? this._summonMeta.normalSummon : this._summonMeta.advancedSummon;

        if (!summonMeta) {
            throw Errors.IncorrectArguments;
        }

        const user = await Game.getUser(userId);
        let lastSummon = armyProfile.lastSummon;
        let isFirstSummon = false;

        if (!lastSummon[summonType]) {
            isFirstSummon = true;
        }

        if (isNumber(iapIndex)) {
            let iapMeta = summonMeta.iaps[iapIndex];
            if (user.hardCurrency < iapMeta.price) {
                throw Errors.NotEnoughCurrency;
            }

            count = iapMeta.count;
            await user.addHardCurrency(-iapMeta.price);
        } else {
            let resetCycle = 86400 / summonMeta.freeOpens;
            let timeUntilNextFreeOpening = Game.nowSec - (armyProfile.lastSummon[summonType] || 0);
            if (timeUntilNextFreeOpening > resetCycle) {
                // free summon
                count = 1;
                lastSummon[summonType] = Game.nowSec;
            } else {
                // check if user has enough tickets
                const inventory = await Game.loadInventory(userId);
                const ticketItem = inventory.getItemByTemplate(summonMeta.ticketItem);
                if (!ticketItem) {
                    throw Errors.NoEnoughItems;
                }

                await inventory.autoCommitChanges(() => {
                    inventory.removeItem(ticketItem.id, count);
                })
            }
        }

        let lastUnitId = armyProfile.lastUnitId;
        const newUnits = await this._summoner.summon(count, summonType, isFirstSummon);
        // assign ids
        for (const unit of newUnits) {
            unit.id = ++lastUnitId;
        }

        // add to user's army
        await this._units.addUnits(userId, newUnits, lastUnitId, lastSummon);
        await user.dailyQuests.onUnitSummoned(count, summonType == SummonType.Advanced);

        this._units.resetCache(userId);
        return newUnits;
    }

    async levelUp(userId: any, unitId: number) {
        const unitRecord = await this._units.getUserUnit(userId, unitId);
        if (!unitRecord) {
            throw Errors.ArmyNoUnit;
        }

        const unit = unitRecord[unitId];
        const meta = unit.troop ? this._troops : this._generals;
        const template = this._unitTemplates[unit.template];

        if (!template) {
            throw Errors.ArmyUnitUnknown;
        }

        const stars = template.stars + unit.promotions;
        const maxLevelRecord = meta.fusionMeta.maxLevelByStars.find(x => x.stars == stars);
        if (!maxLevelRecord) {
            throw Errors.UnexpectedArmyUnit;
        }

        if (unit.level >= maxLevelRecord.maxLevel) {
            throw Errors.ArmyUnitMaxLvl;
        }

        const levelRecord = meta.leveling.levelingSteps[unit.level - 1];
        if (!levelRecord) {
            throw Errors.UnexpectedArmyUnit;
        }

        const user = await Game.getUser(userId);
        if (user.level < 200 && unit.level >= user.level) {
            throw Errors.ArmyUnitMaxLvl;
        }

        if (user.softCurrency < levelRecord.gold) {
            throw Errors.NotEnoughSoft;
        }

        if (!user.inventory.hasItems(meta.essenceItem, levelRecord.essence)) {
            throw Errors.NotEnoughEssence;
        }

        unit.gold += levelRecord.gold;
        unit.essence += levelRecord.essence;

        await user.addSoftCurrency(-levelRecord.gold);
        user.inventory.removeItemByTemplate(meta.essenceItem, levelRecord.essence);
        unit.level++;
        await this._units.onUnitUpdated(userId, unit);
        await user.dailyQuests.onUnitLevelUp(1, unit.troop);

        return unit;
    }

    async equipItem(userId: string, unitId: number, itemIds: number[]) {
        const unitRecord = await this._units.getUserUnit(userId, unitId);
        if (!unitRecord) {
            throw Errors.ArmyNoUnit;
        }

        const inventory = await Game.loadInventory(userId);
        const length = itemIds.length;
        const unit = unitRecord[unitId];
        const slotsEquipped = {};

        for (let i = 0; i < length; ++i) {
            const itemId = itemIds[i];
            const item = inventory.getItemById(itemId);
            if (!item) {
                throw Errors.NoItem;
            }

            if (item.level * 2 > unit.level) {
                throw Errors.IncorrectArguments;
            }

            const itemTemplate = await Game.itemTemplates.getTemplate(item.template);
            if (!itemTemplate) {
                throw Errors.NoTemplate;
            }

            const slotId = getSlot(itemTemplate.equipmentType);
            if (slotsEquipped[slotId]) {
                continue;
            }

            slotsEquipped[slotId] = true;

            if (itemTemplate.type != ItemType.Equipment) {
                throw Errors.NotEquipment;
            }

            await inventory.equipItem(item, unit.items, unit.id);
        }

        await this._units.onUnitUpdated(userId, unit);
    }

    async unequipItem(userId: string, unitId: number, slotId: number) {
        const unitRecord = await this._units.getUserUnit(userId, unitId);
        if (!unitRecord) {
            throw Errors.ArmyNoUnit;
        }

        const unit = unitRecord[unitId];
        const inventory = await Game.loadInventory(userId);

        if (slotId) {
            const item = unit.items[slotId];
            if (item) {
                await inventory.unequipItem(item.id, true);
            }
        } else {
            // unequip all
            for (const slotId in unit.items) {
                await inventory.unequipItem(unit.items[slotId].id, true);
            }
        }

        await this._units.onUnitUpdated(userId, unit);
    }

    async promote(userId: string, unitId: number, units: { [k: string]: number[] }) {
        // units - { ingridient id -> unit ids }
        const unitRecord = await this._units.getUserUnit(userId, unitId);
        if (!unitRecord) {
            throw Errors.ArmyNoUnit;
        }

        const unit = unitRecord[unitId];
        const meta = unit.troop ? this._troops : this._generals;
        const template = this._unitTemplates[unit.template];
        const stars = template.stars + unit.promotions;
        const maxStars = template.stars <= 3 ? 3 : 10;

        if (stars >= maxStars) {
            throw Errors.ArmyUnitMaxPromotions;
        }

        const fusionTemplates = meta.fusionMeta.templates;
        const fusionTemplate = fusionTemplates[stars + 1];
        if (!fusionTemplate) {
            throw Errors.IncorrectArguments;
        }

        let toRemove = [];
        const usedUnits = {};
        for (const ingridient of fusionTemplate.ingridients) {
            const unitsForFusion = units[ingridient.id];
            if (!unitsForFusion || unitsForFusion.length != ingridient.amount) {
                throw Errors.IncorrectArguments;
            }

            toRemove = toRemove.concat(unitsForFusion);

            const targetUnits = await this._units.getUserUnits(userId, unitsForFusion);

            for (const unitId in targetUnits) {
                const targetUnit = targetUnits[unitId];

                if (usedUnits[targetUnit.id]) {
                    throw Errors.IncorrectArguments;
                }
                const targetUnitTemplate = this._unitTemplates[targetUnit.template];

                if (ingridient.copy) {
                    if (unit.template != targetUnit.template) {
                        throw Errors.IncorrectArguments;
                    }
                }

                if (ingridient.stars) {
                    if (targetUnitTemplate.stars + targetUnit.promotions != ingridient.stars) {
                        throw Errors.IncorrectArguments;
                    }
                }

                if (ingridient.sameElement) {
                    if (targetUnitTemplate.element != template.element) {
                        throw Errors.IncorrectArguments;
                    }
                }
            }
        }

        // check souls
        const inventory = await Game.loadInventory(userId);
        if (inventory.countItemsByTemplate(this._meta.soulsItem) < fusionTemplate.souls) {
            throw Errors.NotEnoughResource;
        }

        // check ash
        const price = Game.currencyConversionService.convertToNative(fusionTemplate.price);
        if (price > inventory.getCurrency(CurrencyType.Dkt2)) {
            throw Errors.NotEnoughCurrency;
        }

        inventory.removeItemByTemplate(this._meta.soulsItem, fusionTemplate.souls);
        await inventory.modifyCurrency(CurrencyType.Dkt2, -price)
        unit.souls += fusionTemplate.price;

        // everything is ok, promote unit
        unit.promotions++;
        await this._units.onUnitUpdated(userId, unit);
        // remove ingridient units
        await this._units.removeUnits(userId, toRemove);
    }

    async banish(userId: string, unitIds: number[]) {
        // TODO move to config
        if (unitIds.length > 10) {
            throw Errors.IncorrectArguments;
        }

        const unitRecords = await this._units.getUserUnits(userId, unitIds);
        if (!unitRecords) {
            throw Errors.ArmyNoUnit;
        }

        const resourcesUsed = {
            gold: 0,
            troopEssence: 0,
            generalEssence: 0,
            souls: 0
        };

        const duplicates = {};
        for (const unitId of unitIds) {
            const unit = unitRecords[unitId];

            if (!unit) {
                throw Errors.ArmyNoUnit;
            }

            if (unit.legion != NO_LEGION) {
                throw Errors.UnitInLegion;
            }

            if (duplicates[unit.id]) {
                throw Errors.IncorrectArguments;
            }

            duplicates[unit.id] = true;

            resourcesUsed.gold += unit.gold;
            resourcesUsed.souls += unit.souls * this._meta.refund.souls;

            const template = this._unitTemplates[unit.template];
            resourcesUsed.souls += this._meta.soulsFromBanishment[unit.promotions + template.stars];

            if (unit.troop) {
                resourcesUsed.troopEssence += unit.essence;
            } else {
                resourcesUsed.generalEssence += unit.essence;
            }
        }

        await this._removeEquipmentFromUnits(userId, unitRecords);

        resourcesUsed.gold *= this._meta.refund.gold;
        resourcesUsed.troopEssence *= this._meta.refund.troopEssence;
        resourcesUsed.generalEssence *= this._meta.refund.generalEssence;

        // remove units
        await this._units.removeUnits(userId, unitIds);
        // refund
        const user = await Game.getUser(userId);
        await user.addSoftCurrency(Math.floor(resourcesUsed.gold));

        const inventory = await Game.loadInventory(userId);
        await inventory.addItemTemplates([
            { item: this._troops.essenceItem, quantity: Math.floor(resourcesUsed.troopEssence) },
            { item: this._generals.essenceItem, quantity: Math.floor(resourcesUsed.generalEssence) },
            { item: this._meta.soulsItem, quantity: Math.floor(resourcesUsed.souls) }
        ]);
    }

    async sendToReserve(userId: string, unitIds: number[]) {
        const unitRecords = await this._units.getUserUnits(userId, unitIds);
        if (!unitRecords) {
            throw Errors.ArmyNoUnit;
        }

        // stack units by template and promotions, in case unit was promoted, it must be stacked separately
        // it's done simply with composite key as template id + promotions
        const duplicates = {};
        const units = [];
        for (const unitId of unitIds) {
            const unit = unitRecords[unitId];

            if (!unit) {
                throw Errors.ArmyNoUnit;
            }

            if (unit.legion != NO_LEGION) {
                throw Errors.UnitInLegion;
            }

            if (duplicates[unit.id]) {
                throw Errors.IncorrectArguments;
            }

            duplicates[unit.id] = true;

            units.push(unit);
        }

        const reserve = await this._units.getReservedUnits(userId, units);
        const reserveDelta = {}
        for (const unitId of unitIds) {
            const unit = unitRecords[unitId];
            const key = this._units.getReserveKey(unit);

            if (!reserveDelta[key]) {
                reserveDelta[key] = {
                    template: unit.template,
                    promotions: unit.promotions,
                    count: reserve[key] ? reserve[key].count : 1
                };
            }

            if (reserve[key]) {
                reserveDelta[key].count++;
            }
        }


        await this._units.updateReservedUnits(userId, reserveDelta);
        await this._removeEquipmentFromUnits(userId, unitRecords);
        await this._units.removeUnits(userId, unitIds);
    }

    async createCombatLegion(userId: string, legionIndex: number) {
        const inventory = await Game.loadInventory(userId);
        const combatLegion = new ArmyCombatLegion(
            userId,
            legionIndex,
            this._armyResolver,
            await this._units.getInventory(userId),
            this._units,
            await this._units.getReserve(userId),
            this._legions,
            inventory
        );
        return combatLegion;
    }

    async expandSlots(userId: string) {
        const inventory = await Game.loadInventory(userId);

        if (!inventory.hasItems(this._meta.armyExpansion.expansionItem, 1, true)) {
            throw Errors.NoItem;
        }

        await this._expandSlots(userId, this._meta.armyExpansion.expansionSize);
        await inventory.autoCommitChanges(inventory => {
            inventory.removeItem(this._meta.armyExpansion.expansionItem, 1)
        })
    }

    async buySlotsExpansion(userId: string) {
        const user = await Game.getUser(userId);

        if (user.hardCurrency < this._meta.armyExpansion.expansionPrice) {
            throw Errors.NotEnoughCurrency;
        }

        await this._expandSlots(userId, this._meta.armyExpansion.expansionSize);
        await user.addHardCurrency(-this._meta.armyExpansion.expansionPrice);
    }

    private async _checkFreeSlots(armyProfile: any, requiredSlots: number) {
        if (armyProfile.maxSlots - armyProfile.occupiedSlots < requiredSlots) {
            throw Errors.NotEnoughArmySlots;
        }
    }

    private async _expandSlots(userId: string, count: number) {
        const armyProfile = await this._loadArmy(userId, { "maxSlots": 1 })

        if (armyProfile.maxSlots >= this._meta.armyExpansion.maxSlots) {
            throw Errors.ArmyMaxSlots;
        }

        await this._armiesCollection.updateOne(
            { _id: userId },
            { $inc: { maxSlots: count } }
        )

        Game.emitPlayerEvent(userId, Events.ArmySlots, { maxSlots: armyProfile.maxSlots + count })
    }

    private async _removeEquipmentFromUnits(userId: string, units: { [key: number]: ArmyUnit }) {
        const inventory = await Game.loadInventory(userId);

        for (const unitId in units) {
            const unit = units[unitId];
            // unequip items
            for (const itemSlot in unit.items) {
                const equippedItem = unit.items[itemSlot];
                await inventory.unequipItem(equippedItem.id, true);
            }
        }
    }

    private async _loadLegion(userId: string, legionIndex: number) {
        return this._legions.getLegion(userId, legionIndex);
    }

    private async _loadArmyProfile(userId: string) {
        return this._loadArmy(userId, { "units": 0 })
    }

    private async _loadArmy(userId: string, projection: any = {}) {
        return (await this._armiesCollection.findOneAndUpdate(
            { _id: userId },
            {
                $setOnInsert: {
                    lastUnitId: 0,
                    lastSummon: {},
                    legions: this._legions.createLegions(),
                    occupiedSlots: 0,
                    maxSlots: this._meta.armyExpansion.defaultSlots,
                    units: []
                }
            },
            { projection: projection, upsert: true, returnDocument: ReturnDocument.AFTER }
        )).value;
    }
}

