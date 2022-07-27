import _ from "lodash";
import { BattleSquadBonus, BattleSquadState, BattleUnit } from "../types";
import { BattleController } from "../BattleController";
import { Unit } from "../units/Unit";
import errors from "../../../knightlands-shared/errors";
import { SQUAD_BONUSES } from "../meta";
import game from "../../../game";

export class BattleSquad {
  protected _state: BattleSquadState;
  protected _ctrl: BattleController;

  protected _isEnemy: boolean;
  protected _units: Unit[];

  get units(): Unit[] {
    return this._units;
  }
  
  constructor(units: BattleUnit[], isEnemy: boolean, ctrl: BattleController) {
    this._ctrl = ctrl;
    this._isEnemy = isEnemy;

    this._state = this.getInitialState();
    this._state.units = units;

    this.createUnits();
    this.updateStat();
  }
  
  public init() {
    // Apply squad bonuses
    // https://docs.google.com/spreadsheets/d/1BzNKygvM41HFggswJLnMWzaN3F4mI6D7iWpRMCEm_QM/edit#gid=1792408341
    //this._bonuses = [];
  }
  
  public getInitialState(): BattleSquadState {
    return {
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
    unit.isEnemy = this._isEnemy;
    return new Unit(unit);
  }
  
  public fillSlot(unitId: string, index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw Error("Cannot fill this slot - no such a slot");
    }
    
    const unit = _.cloneDeep(this._ctrl.inventory.getUnitById(unitId) as Unit);
    if (!unit) {
      throw Error(`Unit ${unitId} not found`);
    }

    unit.regenerateFighterId();
    unit.resurrect();

    // Fill slot
    this._units[index] = unit;
    
    // Update state
    this._state.units[index] = unit.serializeForSquad();

    this.updateStat();

    // Event
    this._ctrl.events.userSquad(this._state);

    console.log(`[Squad] Unit ${unitId} was set into slot #${index}`);
  }
  
  public clearSlot(index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw Error("Cannot clear this slot - no such a slot");
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
      //console.log("Bonuses", { unit });
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

    //console.log("Squad bonuses", { bonuses });
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
    const test = game.battleManager.autoCombat;
    this._units.forEach((unit, index) => {
      unit.setIndex(index + (onTop ? 0 : (test ? 5 : 30)));
    });
    this.syncUnits();
  }

  public regenerateFighterIds(): void {
    this._units.forEach((unit, index) => {
      unit.regenerateFighterId();
    });
    this.syncUnits();
  }

  public getFighter(fighterId: string): Unit|null {
    return this._units.find(unit => unit.fighterId === fighterId) || null;
  }

  public callbackDrawFinished(): void {
    this._units.forEach(unit => {
      // Decrease the cooldown
      unit.decreaseAbilitiesCooldownEstimate();
      // Decrease the buff estimate
      unit.decreaseBuffsEstimate();
    });

    this._units.forEach(unit => {
      if (this._isEnemy) {
        this._ctrl.events.enemyFighter(unit);
      } else {
        this._ctrl.events.userFighter(unit);
      }
    });
  }
}
