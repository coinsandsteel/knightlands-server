import _ from "lodash";
import errors from "../../../knightlands-shared/errors";
import { COMMODITY_COINS } from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import { BattleUnit } from "../types";
import { Unit } from "../units/Unit";
import { UNITS } from "./../meta"
import { BattleService } from "./BattleService";

export class BattleInventory extends BattleService {
  protected _core: BattleCore;

  protected _state: BattleUnit[];
  protected _units: Unit[];

  constructor(state: BattleUnit[], core: BattleCore) {
    super();
    this._state = state || [];
    this._core = core;
  }
  
  get unitIds(): string[] {
    return this._units.map(unit => unit.unitId);
  }
  
  public async init() {
    this.createUnits();
  }

  protected createUnits(): void {
    this._units = [];
    this._state.forEach((unit: BattleUnit) => {
      this._units.push(this.makeUnit(unit));
    });
  }
  
  protected makeUnit(unit: BattleUnit): Unit {
    return new Unit(unit, this._core.events);
  }
  
  getState(): BattleUnit[] {
    return this._state;
  }
  
  public getRandomUnit(tier: number): Unit {
    // Get random unit blueprint
    const unitBlueprint = _.cloneDeep(_.sample(UNITS));
    unitBlueprint.tier = tier;
    // Construct unit
    const unit = this.makeUnit(unitBlueprint);
    return unit;
  }

  public getRandomUnitByProps(params: { unitTribe?: string, unitClass?: string }, tier: number): Unit {
    const filteredUnits = _.filter(_.cloneDeep(UNITS), params);
    const unitBlueprint = _.sample(filteredUnits);
    unitBlueprint.tier = tier;

    // Construct unit
    const unit = this.makeUnit(unitBlueprint);
    return unit;
  }

  public addUnit(unit: Unit): Unit {
    this.log("Add unit", { unitId: unit.unitId, template: unit.template, tier: unit.tier });
    
    // Search by template
    const index = this._units.findIndex(entry => entry.template === unit.template && entry.tier === unit.tier);
    // Add or increase quantity
    if (index === -1) {
      this._units.push(unit);
      this._state.push(unit.serialize());
      this._core.events.addUnit(unit);
      this.log("Unit added", unit.unitId);
    } else {
      this._units[index].updateQuantity(unit.quantity);
      this.updateUnitState(unit);
      this.log("Unit stacked", unit.unitId);
    }

    return this._units.find(entry => entry.template === unit.template && entry.tier === unit.tier);
  }

  public setUnits(units: Unit[]) {
    this._units = units;
    this._state = this._units.map(unit => unit.serialize());
    this._core.events.inventory(units);
  }

  public async addExp(unitId: string, value: number) {
    const unit = this.getUnitById(unitId);
    unit.addExpirience(value);
    this.updateUnitState(unit);
  }

  protected updateUnitState(unit: Unit): void{
    const stateIndex = this._state.findIndex(inventoryUnit => inventoryUnit.template === unit.template);
    this._state[stateIndex] = unit.serialize();
    this._core.events.updateUnit(unit);
  }

  public getUnitById(unitId: string): Unit|null {
    return this._units.find((inventoryUnit: Unit) => { 
      return inventoryUnit.unitId === unitId; 
    }) || null;
  }

  public getUnitByFilter(params: { unitTribe?: string, unitClass?: string, tier?: number, template?: number }): Unit|null {
    return _.head(_.find(this._units, params)) || null;
  }

  public upgradeUnitLevel(unitId: string): void {
    const unit = this.getUnitById(unitId);
    if (
      !unit
      ||
      !unit.canUpgradeLevel()
    ) {
      throw Error("Cannot upgrade a unit");
    }

    if (this._core.user.coins < unit.level.price) {
      throw errors.NotEnoughCurrency;
    }

    this._core.user.debitCurrency(COMMODITY_COINS, unit.level.price);
    unit.upgradeLevel();
    this.updateUnitState(unit);

    if (
      !this._core.game.combatStarted
      &&
      this._core.game.squadIncludesUnit(unit.unitId)
    ) {
      this._core.game.proxyUnit(unit.unitId);
    }
  }

  public upgradeUnitAbility(unitId: string, ability: string): void {
    const unit = this.getUnitById(unitId);
    if (
      !unit
      ||
      !unit.canUpgradeAbility(ability)
    ) {
      throw Error("Cannot upgrade a unit's ability");
    }
    
    if (this._core.user.crystals < unit.level.price) {
      throw errors.NotEnoughCurrency;
    }

    this._core.user.debitCurrency(COMMODITY_COINS, unit.level.price);
    unit.upgradeAbility(ability);
    this.updateUnitState(unit);

    if (
      !this._core.game.combatStarted
      &&
      this._core.game.squadIncludesUnit(unit.unitId)
    ) {
      this._core.game.proxyUnit(unit.unitId);
    }
  }
}
