import Game from "../game";
import { Db, Collection } from "mongodb";
import { Collections } from "../database";
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
import ArmySummonType from "../knightlands-shared/army_summon_type";
import SummonType from "../knightlands-shared/army_summon_type";
import ItemType from "../knightlands-shared/item_type";
import Random from "../random";

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

    async init(iapExecutor) {
        console.log("Initializing army manager...");

        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "army" });
        this._generals = await this._db.collection(Collections.Meta).findOne({ _id: "generals" });
        this._troops = await this._db.collection(Collections.Meta).findOne({ _id: "troops" });
        this._abilities = await this._db.collection(Collections.Meta).findOne({ _id: "army_abilities" });
        this._unitTemplates = (await this._db.collection(Collections.Meta).findOne({ _id: "army_units" })).units;

        this._summonMeta = await this._db.collection(Collections.Meta).findOne({ _id: "army_summon_meta" })
        this._summonMeta.advancedSummon.iaps.forEach(iap => {
            iapExecutor.registerAction(iap.iap, async context => {
                return await this.summontUnits(context.user, context.count, context.summonType, true);
            });
            iapExecutor.mapIAPtoEvent(iap.iap, Events.UnitSummoned);
        });

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
            Random.range
        );
    }

    async getUnit(userId: string, id: number) {
        let units = await this._units.getUserUnit(userId, id);
        return units[id];
    }

    async updateUnit(userId, unit: ArmyUnit) {
        return this._units.onUnitUpdated(userId, unit);
    }

    async requestSummon(userId: string, iap: number, summonType: number) {
        let summonData = summonType == ArmySummonType.Advanced ? this._summonMeta.advancedSummon : this._summonMeta.normalSummon;
        let summonMeta = summonData.iaps.find(x => x.iap === iap);
        if (!summonMeta) {
            throw Errors.IncorrectArguments;
        }

        let iapContext = {
            user: userId,
            summonType: summonType,
            count: summonMeta.count,
            iap
        };

        let hasPendingPayment = await Game.paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.PaymentTag);
        if (hasPendingPayment) {
            throw Errors.PaymentIsPending;
        }

        try {
            return await Game.paymentProcessor.requestPayment(
                userId,
                iap,
                this.PaymentTag,
                iapContext
            );
        } catch (exc) {
            throw exc;
        }
    }

    async getSummonStatus(userId) {
        return await Game.paymentProcessor.fetchPaymentStatus(userId, this.PaymentTag, {});
    }

    async getArmy(unitId: string) {
        return await this._armiesCollection.findOne({ _id: unitId });
    }

    async setLegionSlot(userId: string, userLevel: number, legionIndex: number, slotId: number, unitId: number) {
        const legion = await this._loadLegion(userId, legionIndex);

        let unit;

        const prevUnitId = legion.units[slotId];
        const prevUnitRecord = await this._units.getUserUnit(userId, prevUnitId);

        if (!unitId) {
            if (prevUnitRecord) {
                // empty slot
                unit = prevUnitRecord[prevUnitId];
                if (unit) {
                    unit.legion = NO_LEGION;
                }
            }

            delete legion.units[slotId];
            await this._armiesCollection.updateOne(
                { _id: userId },
                { $set: { [`legions.${legionIndex}`]: legion } }
            )
        } else {
            const slot = this._meta.slots.find(x => x.id == slotId);
            if (!slot) {
                throw Errors.IncorrectArguments;
            }

            const unitRecord = (await this._units.getUserUnit(userId, unitId))[unitId];
            if (!unitRecord || unitRecord.troop != slot.troop) {
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
        return this.loadArmyProfile(userId);
    }

    async summonRandomUnit(userId: string, count: number, stars: number) {
        let armyProfile = await this.loadArmyProfile(userId);
        let lastUnitId = armyProfile.lastUnitId;
        const newUnits = await this._summoner.summonWithStars(count, stars);
        // assign ids
        for (const unit of newUnits) {
            unit.id = ++lastUnitId;
        }

        await this._armiesCollection.updateOne({ _id: userId }, { $push: { units: { $each: newUnits } }, $set: { lastUnitId } }, { upsert: true });

        return newUnits;
    }

    async summontUnits(userId: string, count: number, summonType: number, payed: boolean = false) {
        let armyProfile = await this.loadArmyProfile(userId);
        let summonMeta = summonType == SummonType.Normal ? this._summonMeta.normalSummon : this._summonMeta.advancedSummon;

        if (!summonMeta) {
            throw Errors.IncorrectArguments;
        }

        if (!payed) {
            let resetCycle = 86400 / summonMeta.freeOpens;
            let timeUntilNextFreeOpening = Game.nowSec - (armyProfile.lastSummon[summonType] || 0);
            if (timeUntilNextFreeOpening > resetCycle) {
                // free summon
                count = 1;
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
        const newUnits = await this._summoner.summon(count, summonType);
        // assign ids
        for (const unit of newUnits) {
            unit.id = ++lastUnitId;
        }

        // add to user's army
        let lastSummon = armyProfile.lastSummon;
        lastSummon[summonType] = Game.nowSec;
        await this._armiesCollection.updateOne({ _id: userId }, { $push: { units: { $each: newUnits } }, $set: { lastSummon, lastUnitId } }, { upsert: true });

        const user = await Game.getUser(userId);
        await user.dailyQuests.onUnitSummoned(summonType == SummonType.Advanced);

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

    async equipItem(userId: string, unitId: number, itemId: number) {
        const unitRecord = await this._units.getUserUnit(userId, unitId);
        if (!unitRecord) {
            throw Errors.ArmyNoUnit;
        }

        const inventory = await Game.loadInventory(userId);
        const item = inventory.getItemById(itemId);
        if (!item) {
            throw Errors.NoItem;
        }

        const itemTemplate = await Game.itemTemplates.getTemplate(item.template);
        if (!itemTemplate) {
            throw Errors.NoTemplate;
        }

        if (itemTemplate.type != ItemType.Equipment) {
            throw Errors.NotEquipment;
        }

        const unit = unitRecord[unitId];
        await inventory.equipItem(item, unit.items, unit.id);
        await this._units.onUnitUpdated(userId, unit);
    }

    async unequipItem(userId: string, unitId: number, slotId: number) {
        const unitRecord = await this._units.getUserUnit(userId, unitId);
        if (!unitRecord) {
            throw Errors.ArmyNoUnit;
        }

        const unit = unitRecord[unitId];
        const item = unit.items[slotId];
        if (item) {
            const inventory = await Game.loadInventory(userId);
            await inventory.unequipItem(item);
            await this._units.onUnitUpdated(userId, unit);
        }
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
        const maxStars = template.stars < 3 ? 3 : 10;

        if (stars >= maxStars) {
            throw Errors.ArmyUnitMaxPromotions;
        }

        const fusionTemplates = meta.fusionMeta.templates;
        const fusionTemplate = fusionTemplates[stars];
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
        if (inventory.countItemsByTemplate(this._meta.soulsItem) < fusionTemplate.price) {
            throw Errors.NotEnoughResource;
        }

        inventory.removeItemByTemplate(this._meta.soulsItem, fusionTemplate.price);
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
        await user.addSoftCurrency(resourcesUsed.gold);

        const inventory = await Game.loadInventory(userId);
        await inventory.addItemTemplates([
            { item: this._troops.essenceItem, quantity: resourcesUsed.troopEssence },
            { item: this._generals.essenceItem, quantity: resourcesUsed.generalEssence },
            { item: this._meta.soulsItem, quantity: resourcesUsed.souls }
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

        for (const unitId of unitIds) {
            const unit = unitRecords[unitId];
            const key = this._units.getReserveKey(unit);

            if (reserve[key]) {
                reserve[key].count++;
            } else {
                reserve[key] = {
                    template: unit.template,
                    promotions: unit.promotions,
                    count: 1
                };
            }
        }


        await this._units.updateReservedUnits(userId, reserve);
        await this._removeEquipmentFromUnits(userId, unitRecords);
        await this._units.removeUnits(userId, unitIds);
    }

    async createCombatLegion(userId: string, legionIndex: number) {
        const combatLegion = new ArmyCombatLegion(
            userId,
            legionIndex,
            this._armyResolver,
            await this._units.getInventory(userId),
            this._units,
            await this._units.getReserve(userId),
            this._legions
        );
        return combatLegion;
    }

    private async _removeEquipmentFromUnits(userId: string, units: { [key: number]: ArmyUnit }) {
        const inventory = await Game.loadInventory(userId);

        for (const unitId in units) {
            const unit = units[unitId];
            // unequip items
            for (const itemSlot in unit.items) {
                const equippedItem = unit.items[itemSlot];
                if (equippedItem) {
                    delete unit.items[itemSlot];
                    inventory.addItem(equippedItem).equipped = false;
                }
            }
        }
    }

    private async _loadLegion(userId: string, legionIndex: number) {
        return await this._legions.getLegion(userId, legionIndex);
    }

    private async loadArmyProfile(userId: string) {
        return (await this._armiesCollection.findOneAndUpdate(
            { _id: userId },
            {
                $setOnInsert: {
                    lastUnitId: 0,
                    lastSummon: {},
                    legions: this._legions.createLegions()
                }
            },
            { projection: { "units": 0 }, upsert: true, returnOriginal: false }
        )).value;
    }
}

