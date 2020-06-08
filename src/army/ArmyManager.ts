import Game from "../game";
import { Db, Collection, ObjectId } from "mongodb";
import { Collections } from "../database";
import { Lock } from "../utils/lock";
import { ArmyMeta, UnitsMeta, UnitAbilitiesMeta, ArmyUnit, Legion, UnitMeta, ArmySummonMeta } from "./ArmyTypes";
import Errors from "../knightlands-shared/errors";
import { ArmySummoner } from "./ArmySummoner";
import { ArmyUnits } from "./ArmyUnits";
import Events from "../knightlands-shared/events";
import ArmySummonType from "../knightlands-shared/army_summon_type";
import SummonType from "../knightlands-shared/army_summon_type";

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
    private PaymentTag = "ArmySummonTag";

    constructor(db: Db) {
        this._db = db;
        this._lock = new Lock();
        this._summoner = new ArmySummoner(db);
        this._units = new ArmyUnits(db);

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

    async setLegionSlot(user: any, legionIndex: number, slotId: number, unitId: number) {
        const unitExists = await this._armiesCollection.findOne({ _id: user.address, "units.id": unitId }, { $project: { "units.$": 1, "legions": 1 } });
        if (!unitExists) {
            throw Errors.ArmyNoUnit;
        }

        const slot = this._meta.slots.find(x => x.id == slotId);
        if (!slot) {
            throw Errors.IncorrectArguments;
        }

        if (unitExists.units[0].troop != slot.troop) {
            throw Errors.IncorrectArguments;
        }

        if (slot.levelRequired > user.level) {
            throw Errors.IncorrectArguments;
        }

        const legions: Legion[] = unitExists.legions || this.createLegions();
        if (legionIndex < 0 || legions.length <= legionIndex) {
            throw Errors.IncorrectArguments;
        }

        legions[legionIndex].units[slotId] = unitId;
    }

    async getSummonOverview(userId: string) {
        return await this._armiesCollection.findOne({ _id: userId }, { "units": 0 });
    }

    async summontUnits(userId: string, count: number, summonType: number, payed: boolean = false) {
        let unitRecord = (await this._armiesCollection.findOneAndUpdate({ _id: userId }, {
            $setOnInsert: {
                lastUnitId: 0,
                lastSummon: {}
            },
        }, { projection: { "units": 0 }, upsert: true, returnOriginal: false })).value;

        let summonMeta = summonType == SummonType.Normal ? this._summonMeta.normalSummon : this._summonMeta.advancedSummon;

        if (!payed) {
            let resetCycle = 86400 / summonMeta.freeOpens;
            let timeUntilNextFreeOpening = Game.nowSec - (unitRecord.lastSummon[summonType] || 0);
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

                await inventory.autoCommitChanges(()=>{
                    inventory.removeItem(ticketItem.id, count);
                })
            }
        }

        let lastUnitId = unitRecord.lastUnitId;
        const newUnits = await this._summoner.summon(count, summonType);
        // assign ids
        for (const unit of newUnits) {
            unit.id = ++lastUnitId;
        }

        // add to user's army
        let lastSummon = unitRecord.lastSummon;
        lastSummon[summonType] = Game.nowSec;
        await this._armiesCollection.updateOne({ _id: userId }, { $push: { units: { $each: newUnits } }, $set: { lastSummon, lastUnitId } }, { upsert: true });

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

        await user.addSoftCurrency(-levelRecord.gold);
        await user.inventory.removeItemByTemplate(meta.essenceItem, levelRecord.essence);
        unit.level++;
        await this._units.onUnitUpdated(userId, unit);

        return unit;
    }

    private createLegions() {

    }
}

