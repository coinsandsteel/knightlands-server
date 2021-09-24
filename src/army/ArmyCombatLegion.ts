import ArmyResolver from "../knightlands-shared/army_resolver";
import { ArmyUnit, Legion, ArmyReserve } from "./ArmyTypes";
import { ArmyUnits } from "./ArmyUnits";
import { ArmyLegions } from "./ArmyLegions";
import Game from "../game";
import Random from "../random";
import { ObjectId } from "mongodb";

export class ArmyCombatLegion {
    private _armyResolver: ArmyResolver;
    private _legionIndex: number;
    private _userId: ObjectId;
    private _armyUnits: ArmyUnits;
    private _legions: ArmyLegions;
    private _unitIndex: {};
    private _userInventory: any;

    public unitIds: number[];

    constructor(
        userId: ObjectId,
        legionIndex: number,
        armyResolver: ArmyResolver,
        allUnits: ArmyUnit[],
        armyUnits: ArmyUnits,
        reservedUnits: ArmyReserve,
        legions: ArmyLegions,
        userInventory: any
    ) {
        this._userInventory = userInventory;
        this._userId = userId;
        this._armyResolver = armyResolver;
        this._legionIndex = legionIndex;
        this._legions = legions;
        this._armyUnits = armyUnits;
        this._unitIndex = this._armyResolver.buildUnitsIndex(allUnits, reservedUnits);
    }

    get index() {
        return this._legionIndex;
    }

    async attackRaid(raidBoss, bonusDamage: number, playerStats: any, raid: number) {
        const legion: Legion = await this._legions.getLegion(this._userId, this._legionIndex);
        const unitIds: number[] = [];
        for (const slotId in legion.units) {
            unitIds.push(legion.units[slotId]);
        }

        this.unitIds = unitIds;

        const unitsDict = await this._armyUnits.getUserUnits(this._userId, unitIds);
        const unitsFound = Object.keys(unitsDict).length;
        const units: ArmyUnit[] = new Array(unitsFound);
        let unitIndex = 0;
        for (let i in unitsDict) {
            const unit = unitsDict[i];
            if (!unit) {
                continue;
            }

            units[unitIndex] = unit;

            for (let slotId in unit.items) {
                const itemInSlot = unit.items[slotId];
                if (itemInSlot) {
                    unit.items[slotId] = this._userInventory.getItemById(itemInSlot.id);
                }
            }

            unitIndex++;
        }

        const resolveResult = this._armyResolver.resolve(units, this._unitIndex, raid, playerStats, bonusDamage);
        // console.log(JSON.stringify(resolveResult, null, 2))

        raidBoss._applyDamage(resolveResult.totalDamageOutput);

        return resolveResult;
    }
}
