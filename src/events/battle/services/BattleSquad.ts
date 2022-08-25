import _ from "lodash";
import { BattleInitiativeRatingEntry, BattleSquadState, BattleUnit } from "../types";
import { BattleCore } from "./BattleCore";
import { Unit } from "../units/Unit";
import { SQUAD_BONUSES } from "../meta";
import game from "../../../game";
import { BattleService } from "./BattleService";

export class BattleSquad extends BattleService {
  protected _state: BattleSquadState;
  protected _core: BattleCore;

  protected _isEnemy: boolean;
  protected _units: (Unit|null)[];

  get units(): Unit[] {
    return this._units.filter(u => u);
  }
  
  get liveUnits(): Unit[] {
    return this._units.filter(u => u).filter(unit => !unit.isDead);
  }
  
  constructor(units: BattleUnit[], isEnemy: boolean, core: BattleCore) {
    super();
    
    this._core = core;
    this._isEnemy = isEnemy;

    this._state = this.getInitialState();
    this._state.units = units;

    this.pullUnits();
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
    this.pushUnits();
    return this._state;
  }
  
  protected pullUnits(): void {
    this._units = [];
    this._state.units.forEach((unit: BattleUnit|null) => {
      this._units.push(unit ? this.makeUnit(unit) : null);
    });
  }
  
  public pushUnits(): void {
    this._state.units = [];
    this._units.forEach((unit: Unit|null, index: number) => {
      this._state.units[index] = unit ? unit.serializeForSquad() : null;
    });
  }
  
  protected makeUnit(unit: BattleUnit): Unit {
    unit.isEnemy = this._isEnemy;
    return new Unit(unit, this._core.events);
  }
  
  public fillSlot(unitId: string, index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw Error("Cannot fill this slot - no such a slot");
    }
    
    const unit = _.cloneDeep(this._core.inventory.getUnitById(unitId) as Unit);
    if (!unit) {
      throw Error(`Unit ${unitId} not found`);
    }

    unit.regenerateFighterId();
    unit.reset();

    // Fill slot
    this._units[index] = unit;

    this.updateStat();

    // Event
    this.sync();

    this.log(`Unit ${unitId} was set into slot #${index}`);
  }
  
  public clearSlot(index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw Error("Cannot clear this slot - no such a slot");
    }
    
    // Fill slot
    this._units[index] = null;

    this.updateStat();

    // Event
    this.sync();
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

    this.sync();
  }
  
  public sync(): void {
    this.pushUnits();
    this._core.events.userSquad(this._state);
  }

  public setInitiativeRating(rating: BattleInitiativeRatingEntry[]) {
    this.units.forEach(unit => {
      const ratingIndex = _.findIndex(rating, { fighterId: unit.fighterId });
      if (ratingIndex !== -1) {
        unit.setRatingIndex(ratingIndex+1);
      }
    });
  }

  protected setBonuses(): void {
    if (!this.units.length) {
      return;
    }

    let stat = {};

    this.units.forEach(unit => {
      //this.log("Bonuses", { unit });
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
    this.units.forEach(unit => {
      unit.resetBuffs();
      bonuses.forEach(bonus => unit.addBuff({ source: "squad", ...bonus }));
    });

    // this.log("Squad bonuses", { bonuses });
  }
  
  public setPower(): void {
    if (!this.units.length) {
      this._state.power = 0;
      return;
    }

    this._state.power = _.sumBy(this.units, "power");
  }
  
  public includesUnit(unitId: string): boolean {
    return this.units.findIndex(unit => unit.unitId === unitId) !== -1;
  }

  public updateStat(): void {
    this.setBonuses();
    this.setPower();
  }

  public resetState(): void {
    this.units.forEach((unit, index) => {
      // Reset
      unit.reset();
      // Reset indexes
      unit.setIndex(index + (this._isEnemy ? 0 : 30));
    });
  }

  public regenerateFighterIds(): void {
    this.units.forEach((unit, index) => {
      unit.regenerateFighterId();
    });
  }

  public getFighter(fighterId: string): Unit|null {
    return this.units.find(unit => unit.fighterId === fighterId) || null;
  }

  public callbackDrawFinished(): void {
    this.units.forEach(unit => {
      // Decrease the cooldown
      unit.decreaseAbilitiesCooldownEstimate();
      // Decrease the buff estimate
      unit.decreaseBuffsEstimate();
    });
  }

  public maximize(): void {
    this.units.forEach(unit => unit.maximize());
    this.setPower();
    this.sync();
  }
}
