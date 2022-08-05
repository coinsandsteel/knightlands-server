import _ from "lodash";
import { BattleInitiativeRatingEntry, BattleSquadState, BattleUnit } from "../types";
import { BattleController } from "../BattleController";
import { Unit } from "../units/Unit";
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
  
  get liveUnits(): Unit[] {
    return this._units.filter(unit => !unit.isDead);
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
    this.resetState();
    this.updateStat();
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
  
  public syncUnits(): void {
    this._units.forEach((unit: Unit, index: number) => {
      this._state.units[index] = unit.serializeForSquad();
    });
  }
  
  protected makeUnit(unit: BattleUnit): Unit {
    unit.isEnemy = this._isEnemy;
    return new Unit(unit, this._ctrl.events);
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
    unit.reset();

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
  
  public setInitiativeRating(rating: BattleInitiativeRatingEntry[]) {
    this._units.forEach(unit => {
      const ratingIndex = _.findIndex(rating, { fighterId: unit.fighterId });
      if (ratingIndex !== -1) {
        unit.setRatingIndex(ratingIndex+1);
      }
    });
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

    // Apply bonuses
    this._units.forEach(unit => {
      bonuses.forEach(bonus => unit.buff(bonus));
    });

    // console.log("Squad bonuses", { bonuses });
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

  public resetState(): void {
    const test = game.battleManager.autoCombat;
    this._units.forEach((unit, index) => {
      // Reset indexes
      unit.setIndex(index + (this._isEnemy ? 0 : (test ? 5 : 30)));
      // Reset
      unit.reset();
    });
  }

  public regenerateFighterIds(): void {
    this._units.forEach((unit, index) => {
      unit.regenerateFighterId();
    });
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
      // Re-calc buffs
      unit.calcResult();
    });
  }
}
