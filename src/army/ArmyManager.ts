import Game from "../game";
import { Db, Collection, ObjectId } from "mongodb";
import { Collections } from "../database";
import { Lock } from "../utils/lock";
import { ArmyMeta, UnitsMeta, UnitAbilitiesMeta, ArmyUnit, Legion, UnitMeta } from "./ArmyTypes";
import Errors from "../knightlands-shared/errors";
const WeightedList = require("../js-weighted-list");

export class ArmyManager {
    private _db: Db;
    private _lock: Lock;
    private _meta: ArmyMeta;
    private _troops: UnitsMeta;
    private _generals: UnitsMeta;
    private _units: { [key: string]: UnitMeta };
    private _abilities: UnitAbilitiesMeta;
    private _armiesCollection: Collection;

    constructor(db: Db) {
        this._db = db;
        this._lock = new Lock();

        // keep army in separated collection
        this._armiesCollection = this._db.collection(Collections.Armies);
    }

    async init() {
        console.log("Initializing army manager...");

        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "army" });
        this._generals = await this._db.collection(Collections.Meta).findOne({ _id: "generals" });
        this._troops = await this._db.collection(Collections.Meta).findOne({ _id: "troops" });
        this._abilities = await this._db.collection(Collections.Meta).findOne({ _id: "army_abilities" });
        this._units = (await this._db.collection(Collections.Meta).findOne({ _id: "army_units" })).units;
    }

    async getArmy(unitId: string) {
        return await this._armiesCollection.findOne({ _id: unitId });
    }

    async setLegionSlot(user: any, legionIndex: number, slotId: number, unitId: number) {
        const unitExists = await this._armiesCollection.findOne({ _id: user.address, "units.id": unitId }, { $project: { "units.$": 1, "legions": 1 }});
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

    async addSummonedUnits(user: any, unitIds: any[]) {
        let lastUnitId = await this._armiesCollection.findOne({ _id: user.address }, { "lastUnitId": 1 });
        lastUnitId = lastUnitId || 0;

        const newUnits = [];
        for (const unitId of unitIds) {
            const unitTemplate = this._units[unitId];

            // create unit object
            const unit: ArmyUnit = {
                troop: unitTemplate.troop,
                id: ++lastUnitId,
                template: unitId,
                promotiions: 0,
                level: 1,
                abilities: []
            };

            // assign fixed abilities
            unit.abilities.push(...unitTemplate.fixedAbilities);

            // select random abilities based on star level
            const randomAbiltiiesToRoll = unitTemplate.stars < 4 ? 1 : 2;
            const abilitiesPool = new WeightedList(unitTemplate.abilityPool.abilities);
            const rolledAbilities = abilitiesPool.peek(randomAbiltiiesToRoll);
            unit.abilities.push(...rolledAbilities.map(x => x.key));

            newUnits.push(unit);
        }


        // add to user's army
        await this._armiesCollection.update({ _id: user.address }, { $push: { units: newUnits } }, { upsert: true });
    }

    private createLegions() {

    }
}

