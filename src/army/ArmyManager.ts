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
import { ObjectId } from "mongodb";
import User from "../user";

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

    async getUnit(userId: ObjectId, id: number) {
        let units = await this._units.getUserUnit(userId, id);
        if (!units) {
            return null;
        }
        return units[id];
    }

    async updateUnit(user: User, unit: ArmyUnit) {
        return this._units.onUnitUpdated(user, unit);
    }

    async getSummonStatus(user) {
        return Game.paymentProcessor.fetchPaymentStatus(user.id, this.PaymentTag, {});
    }

    async getArmyPreview(userId: ObjectId) {
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

    async getArmy(user: User) {
        return this._loadArmy(user.id);
    }

    async setLegionSlot(user: User, userLevel: number, legionIndex: number, slotId: number, unitId: number) {
        const legion = await this._loadLegion(user.id, legionIndex);

        let unit;

        const prevUnitId = legion.units[slotId];
        const prevUnitRecord = await this._units.getUserUnit(user.id, prevUnitId);

        if (prevUnitRecord) {
            // empty slot
            unit = prevUnitRecord[prevUnitId];
            if (unit) {
                unit.legion = NO_LEGION;
                await this._units.onUnitUpdated(user, unit);
            }
        }

        delete legion.units[slotId];

        if (unitId) {
            const slot = this._meta.slots.find(x => x.id == slotId);
            if (!slot) {
                throw Errors.IncorrectArguments;
            }

            const unitRecord = (await this._units.getUserUnit(user.id, unitId))[unitId];
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
                const usedUnits = await this._units.getUserUnits(user.id, ids);
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
            await this._units.onUnitUpdated(user, unit);
        }

        await this._legions.onLegionUpdated(user.id, legion);
    }

    async getSummonOverview(user: User) {
        return this._loadArmyProfile(user.id);
    }

    async summonRandomUnit(user: User, count: number, stars: number, summonType: number) {
        const armyProfile = await this._loadArmyProfile(user.id);

        await this._checkFreeSlots(armyProfile, 1);

        let lastUnitId = armyProfile.lastUnitId;
        const newUnits = await this._summoner.summonWithStars(count, stars, summonType);
        // assign ids
        for (const unit of newUnits) {
            unit.id = ++lastUnitId;
        }

        await this._units.addUnits(user.id, newUnits, lastUnitId);
        this._units.resetCache(user.id);
        return newUnits;
    }

    async summontUnits(user: User, count: number, summonType: number, iapIndex: number) {
        let armyProfile = await this._loadArmyProfile(user.id);

        let summonMeta = summonType == SummonType.Normal ? this._summonMeta.normalSummon : this._summonMeta.advancedSummon;

        if (!summonMeta) {
            throw Errors.IncorrectArguments;
        }

        let resetCycle = 86400 / summonMeta.freeOpens;
        let timeUntilNextFreeOpening = Game.nowSec - (armyProfile.lastSummon[summonType] || 0);
        const isFree = timeUntilNextFreeOpening > resetCycle;
        if (isFree) {
            count = 1;
        }

        await this._checkFreeSlots(armyProfile, count);

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
            if (isFree) {
                lastSummon[summonType] = Game.nowSec;
            } else {
                // check if user has enough tickets
                const inventory = await Game.loadInventoryById(user.id);
                const ticketItem = inventory.getItemByTemplate(summonMeta.ticketItem);
                if (!ticketItem) {
                    throw Errors.NoEnoughItems;
                }

                await user.autoCommitChanges(() => {
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
        await this._units.addUnits(user.id, newUnits, lastUnitId, lastSummon);
        await user.dailyQuests.onUnitSummoned(count, summonType == SummonType.Advanced);

        this._units.resetCache(user.id);
        return newUnits;
    }

    async levelUp(user: User, unitId: number) {
        const unitRecord = await this._units.getUserUnit(user.id, unitId);
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
        await this._units.onUnitUpdated(user, unit);
        await user.dailyQuests.onUnitLevelUp(1, unit.troop);

        return unit;
    }

    async equipItem(user: User, unitId: number, itemIds: number[]) {
        const unitRecord = await this._units.getUserUnit(user.id, unitId);
        if (!unitRecord) {
            throw Errors.ArmyNoUnit;
        }

        const inventory = await Game.loadInventoryById(user.id);
        const length = itemIds.length;
        const unit = unitRecord[unitId];
        const slotsEquipped = {};

        for (let i = 0; i < length; ++i) {
            const itemId = itemIds[i];
            const item = inventory.getItemById(itemId);
            if (!item) {
                throw Errors.NoItem;
            }

            if (item.level > unit.level) {
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

        await this._units.onUnitUpdated(user, unit);
    }

    async unequipItem(user: User, unitId: number, slotId: number) {
        const unitRecord = await this._units.getUserUnit(user.id, unitId);
        if (!unitRecord) {
            throw Errors.ArmyNoUnit;
        }

        const unit = unitRecord[unitId];
        const inventory = await Game.loadInventoryById(user.id);

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

        await this._units.onUnitUpdated(user, unit);
    }

    async promote(user: User, unitId: number, units: { [k: string]: number[] }) {
        // units - { ingridient id -> unit ids }
        const unitRecord = await this._units.getUserUnit(user.id, unitId);
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

            const targetUnits = await this._units.getUserUnits(user.id, unitsForFusion);

            if (!targetUnits) {
                throw Errors.IncorrectArguments;
            }

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
        const inventory = await Game.loadInventoryById(user.id);
        if (inventory.countItemsByTemplate(this._meta.soulsItem) < fusionTemplate.souls) {
            throw Errors.NotEnoughResource;
        }

        // check flesh
        const price = Game.currencyConversionService.convertToNative(CurrencyType.Dkt, fusionTemplate.price);
        if (price > inventory.getCurrency(CurrencyType.Dkt)) {
            throw Errors.NotEnoughCurrency;
        }

        inventory.removeItemByTemplate(this._meta.soulsItem, fusionTemplate.souls);
        await inventory.modifyCurrency(CurrencyType.Dkt, -price)
        unit.souls += fusionTemplate.price;

        // everything is ok, promote unit
        unit.promotions++;
        await this._units.onUnitUpdated(user, unit);
        // remove ingridient units
        await this._units.removeUnits(user.id, toRemove);
    }

    async banish(user: User, unitIds: number[]) {
        // TODO move to config
        if (unitIds.length > 10) {
            throw Errors.IncorrectArguments;
        }

        const unitRecords = await this._units.getUserUnits(user.id, unitIds);
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
            resourcesUsed.souls += this._meta.soulsFromBanishment[unit.promotions + template.stars - 1];

            if (unit.troop) {
                resourcesUsed.troopEssence += unit.essence;
            } else {
                resourcesUsed.generalEssence += unit.essence;
            }
        }

        await this._removeEquipmentFromUnits(user, unitRecords);

        resourcesUsed.gold *= this._meta.refund.gold;
        resourcesUsed.troopEssence *= this._meta.refund.troopEssence;
        resourcesUsed.generalEssence *= this._meta.refund.generalEssence;

        // remove units
        await this._units.removeUnits(user.id, unitIds);
        // refund
        const cachedUser = await Game.getUser(user.address);
        await cachedUser.addSoftCurrency(Math.floor(resourcesUsed.gold));

        const inventory = await Game.loadInventoryById(user.id);
        await inventory.addItemTemplates([
            { item: this._troops.essenceItem, quantity: Math.floor(resourcesUsed.troopEssence) },
            { item: this._generals.essenceItem, quantity: Math.floor(resourcesUsed.generalEssence) },
            { item: this._meta.soulsItem, quantity: Math.floor(resourcesUsed.souls) }
        ]);
    }

    async sendToReserve(user: User, unitIds: number[]) {
        const unitRecords = await this._units.getUserUnits(user.id, unitIds);
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

        const reserve = await this._units.getReservedUnits(user.id, units);
        const reserveDelta = {}
        for (const unitId of unitIds) {
            const unit = unitRecords[unitId];
            const key = this._units.getReserveKey(unit);

            if (!reserveDelta[key]) {
                reserveDelta[key] = {
                    template: unit.template,
                    promotions: unit.promotions,
                    count: reserve[key] ? reserve[key].count : 0
                };
            }

            reserveDelta[key].count++;
        }


        await this._units.updateReservedUnits(user, reserveDelta);
        await this._removeEquipmentFromUnits(user, unitRecords);
        await this._units.removeUnits(user.id, unitIds);
    }

    async createCombatLegion(user: User, legionIndex: number) {
        const inventory = await Game.loadInventoryById(user.id);
        const combatLegion = new ArmyCombatLegion(
            user.id,
            legionIndex,
            this._armyResolver,
            await this._units.getInventory(user.id),
            this._units,
            await this._units.getReserve(user.id),
            this._legions,
            inventory
        );
        return combatLegion;
    }

    async expandSlots(user: User, slots: number) {
        await this._expandSlots(user, slots);
    }

    async buySlotsExpansion(user: User) {
        if (user.hardCurrency < this._meta.armyExpansion.expansionPrice) {
            throw Errors.NotEnoughCurrency;
        }

        await this._expandSlots(user, this._meta.armyExpansion.expansionSize);
        await user.addHardCurrency(-this._meta.armyExpansion.expansionPrice);
    }

    private async _checkFreeSlots(armyProfile: any, requiredSlots: number) {
        const totalUnits = await this._armiesCollection.count({ _id: armyProfile._id });
        if (armyProfile.maxSlots - totalUnits < requiredSlots) {
            throw Errors.NotEnoughArmySlots;
        }
    }

    private async _expandSlots(user: User, count: number) {
        const armyProfile = await this._loadArmy(user.id, { "maxSlots": 1 })

        if (armyProfile.maxSlots >= this._meta.armyExpansion.maxSlots) {
            throw Errors.ArmyMaxSlots;
        }

        await this._armiesCollection.updateOne(
            { _id: user.id },
            { $inc: { maxSlots: count } }
        )

        Game.emitPlayerEvent(user.address, Events.ArmySlots, { maxSlots: armyProfile.maxSlots + count })
    }

    private async _removeEquipmentFromUnits(user: User, units: { [key: number]: ArmyUnit }) {
        const inventory = await Game.loadInventoryById(user.id);

        for (const unitId in units) {
            const unit = units[unitId];
            // unequip items
            for (const itemSlot in unit.items) {
                const equippedItem = unit.items[itemSlot];
                await inventory.unequipItem(equippedItem.id, true);
            }
        }
    }

    private async _loadLegion(userId: ObjectId, legionIndex: number) {
        return this._legions.getLegion(userId, legionIndex);
    }

    private async _loadArmyProfile(userId: ObjectId) {
        return this._loadArmy(userId, { "units": 0 })
    }

    private async _loadArmy(userId: ObjectId, projection: any = {}) {
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

