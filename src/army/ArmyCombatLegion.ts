import ArmyResolver from "../knightlands-shared/army_resolver";
import { ArmyUnit, Legion, ArmyReserve } from "./ArmyTypes";
import { ArmyUnits } from "./ArmyUnits";
import { ArmyLegions } from "./ArmyLegions";
import Game from "../game";
import Random from "../random";

export class ArmyCombatLegion {
    private _armyResolver: ArmyResolver;
    private _legionIndex: number;
    private _userId: string;
    private _armyUnits: ArmyUnits;
    private _legions: ArmyLegions;
    private _unitIndex: {};

    public unitIds: number[];

    constructor(
        userId: string,
        legionIndex: number,
        armyResolver: ArmyResolver,
        allUnits: ArmyUnit[],
        armyUnits: ArmyUnits,
        reservedUnits: ArmyReserve,
        legions: ArmyLegions
    ) {
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

    async attackRaid(raidBoss, bonusDamage: number, playerUnit: any, raid: number) {
        const legion: Legion = await this._legions.getLegion(this._userId, this._legionIndex);
        const unitIds: number[] = [];
        for (const slotId in legion.units) {
            unitIds.push(legion.units[slotId]);
        }

        this.unitIds = unitIds;

        const unitsDict = await this._armyUnits.getUserUnits(this._userId, unitIds);
        const units: ArmyUnit[] = new Array(unitIds.length);
        for (let i = 0; i < unitIds.length; ++i) {
            units[i] = unitsDict[unitIds[i]];
        }

        const resolveResult = this._armyResolver.resolve(units, this._unitIndex, raid);
        console.log(JSON.stringify(resolveResult, null, 2))

        raidBoss._applyDamage(resolveResult.totalDamageOutput);

        return resolveResult;
    }
}
