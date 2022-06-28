import _ from "lodash";
import { BattleSquadBonus, BattleSquadState, BattleUnit } from "../types";
import { BattleController } from "../BattleController";
import { Unit } from "../units/Unit";
import errors from "../../../knightlands-shared/errors";
import { SQUAD_BONUSES } from "../meta";

export class BattleSquad {
  protected _state: BattleSquadState;
  protected _ctrl: BattleController;

  protected _units: Unit[];

  constructor(units: BattleUnit[]|null, ctrl: BattleController) {
    this._ctrl = ctrl;

    this.setInitialState();
    this._state.units = units || [];

    this.createUnits();
    this.updateStat();
  }
  
  public init() {
    // Apply squad bonuses
    // https://docs.google.com/spreadsheets/d/1BzNKygvM41HFggswJLnMWzaN3F4mI6D7iWpRMCEm_QM/edit#gid=1792408341
    //this._bonuses = [];
  }
  
  protected setInitialState() {
    this._state = {
      power: 0,
      bonuses: [],
      units: []
    } as BattleSquadState;
  }
  
  public getState(): BattleSquadState {
    this.syncUnits();
    return this._state;
  }
  
  protected createUnits(): void {
    this._units = [];
    this._state.units.forEach((unit: BattleUnit) => {
      this._units.push(this.makeUnit(unit));
    });
  }
  
  protected syncUnits(): void {
    this._units.forEach((unit: Unit, index: number) => {
      this._state.units[index] = unit.serializeForSquad();
    });
  }
  
  protected makeUnit(unit: BattleUnit): Unit {
    return new Unit(unit);
  }
  
  public fillSlot(unitId: string, index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw errors.IncorrectArguments;
    }
    
    const unit = _.cloneDeep(this._ctrl.inventory.getUnitById(unitId) as Unit);
    if (!unit) {
      throw Error("Unit not found");
    }

    unit.regenerateFighterId();

    // Fill slot
    this._units[index] = unit;
    
    // Update state
    this._state.units[index] = unit.serializeForSquad();

    this.updateStat();

    // Event
    this._ctrl.events.userSquad(this._state);
  }
  
  public clearSlot(index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw errors.IncorrectArguments;
    }
    
    // Fill slot
    delete this._units[index];
    
    // Update state
    delete this._state.units[index];

    this.updateStat();

    // Event
    this._ctrl.events.userSquad(this._state);
  }
  
  public proxyUnit(unitId: string): void {
    for (let index = 0; index < 5; index++) {
      if (
        this._units[index]
        &&
        this._units[index].unitId === unitId
      ) {
        this.fillSlot(unitId, index);
      }
    }

    this._ctrl.events.userSquad(this._state);
  }
  
  protected setBonuses(): void {
    if (!this._units.length) {
      return;
    }

    let stat = {};

    this._units.forEach(unit => {
      console.log("Bonuses", { unit });
      stat = {
        ...stat, 
        [unit.tribe]: { 
          ...stat[unit.tribe], 
          ...{ [unit.tier]: _.get(stat, `${unit.tribe}.${unit.tier}`, 0) + 1 }
        }
      };
    });

    let bonuses = [];
    _.forOwn(stat, (tribeStat, unitTribe) => {
      _.forOwn(tribeStat, (tierCount, unitTier) => {
        if (tierCount >= 2) {
          bonuses.push(
            SQUAD_BONUSES[unitTribe][unitTier - 1][tierCount - 2]
          );
        }
      });
    });

    this._state.bonuses = bonuses;

    console.log("Squad bonuses", { bonuses });
  }
  
  protected setPower(): void {
    if (!this._units.length) {
      return;
    }

    this._state.power = _.sumBy(this._units, "power");
  }
  
  public includesUnit(unitId: string): boolean {
    return this._units.findIndex(unit => unit.unitId === unitId) !== -1;
  }

  protected updateStat(): void {
    this.setBonuses();
    this.setPower();
  }

  public setInitialIndexes(onTop: boolean): void {
    this._units.forEach((unit, index) => {
      unit.setIndex(index + (onTop ? 0 : 30));
    });
    this.syncUnits();
  }

  public regenerateFighterIds(): void {
    this._units.forEach((unit, index) => {
      unit.regenerateFighterId();
    });
    this.syncUnits();
  }
}
