import _ from "lodash";
import errors from "../../../knightlands-shared/errors";
import { COMMODITY_COINS } from "../../../knightlands-shared/battle";
import { BattleController } from "../BattleController";
import { BattleUnit } from "../types";
import { Unit } from "../units/Unit";
import { UNITS } from "./../meta"

export class BattleInventory {
  protected _ctrl: BattleController;

  protected _state: BattleUnit[];
  protected _units: Unit[];

  constructor(state: BattleUnit[], ctrl: BattleController) {
    this._state = state || [];
    this._ctrl = ctrl;
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
    return new Unit(unit);
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

  public getRandomUnitByProps(tribe: string, tier: number): Unit {
    const filteredUnits = _.cloneDeep(UNITS)
      .filter(unit => unit.unitTribe === tribe);

    const unitBlueprint = _.sample(filteredUnits);
    unitBlueprint.tier = tier;

    // Construct unit
    const unit = this.makeUnit(unitBlueprint);
    return unit;
  }

  public addUnit(unit: Unit) {
    // Search by template
    const index = this._units.findIndex(inventoryUnit => inventoryUnit.template === unit.template && inventoryUnit.tier === unit.tier);

    console.log("Add unit", unit.unitId);
    
    // Add or increase quantity
    if (index === -1) {
      this._units.push(unit);
      this._state.push(unit.serialize());
      this._ctrl.events.addUnit(unit);
      console.log("Unit added", unit.unitId);
    } else {
      this._units[index].updateQuantity(unit.quantity);
      this.updateUnitState(unit);
      console.log("Unit stacked", unit.unitId);
    }
  }

  public setUnits(units: Unit[]) {
    this._units = units;
    this._state = this._units.map(unit => unit.serialize());
    this._ctrl.events.inventory(units);
  }

  public async addExp(unitId: string, value: number) {
    const unit = this.getUnitById(unitId);
    if (unit && !unit.level.next) {
      unit.addExpirience(value);
      this.updateUnitState(unit);
    }
  }

  protected updateUnitState(unit: Unit): void{
    const stateIndex = this._state.findIndex(inventoryUnit => inventoryUnit.template === unit.template);
    this._state[stateIndex] = unit.serialize();
    this._ctrl.events.updateUnit(unit);
  }

  public getUnitById(unitId: string): Unit|null {
    return this._units.find((inventoryUnit: Unit) => { 
      return inventoryUnit.unitId === unitId; 
    }) || null;
  }

  public getUnitByTemplate(template: number): Unit|null {
    return this._units.find((inventoryUnit: Unit) => inventoryUnit.template === template) || null;
  }

  public getUnitByTemplateAndTier(template: number, tier: number): Unit|null {
    return this._units.find((inventoryUnit: Unit) => inventoryUnit.template === template && inventoryUnit.tier === tier) || null;
  }

  public upgradeUnitLevel(unitId: string): void {
    const unit = this.getUnitById(unitId);
    if (
      !unit
      ||
      !unit.canUpgradeLevel()
    ) {
      throw errors.IncorrectArguments;
    }

    if (this._ctrl.user.coins < unit.level.price) {
      throw errors.NotEnoughCurrency;
    }

    this._ctrl.user.debitCurrency(COMMODITY_COINS, unit.level.price);
    unit.upgradeLevel();
    this.updateUnitState(unit);

    if (
      !this._ctrl.game.combatStarted
      &&
      this._ctrl.game.squadIncludesUnit(unit.unitId)
    ) {
      this._ctrl.game.proxyUnit(unit.unitId);
    }
  }

  public upgradeUnitAbility(unitId: string, ability: string): void {
    const unit = this.getUnitById(unitId);
    if (
      !unit
      ||
      !unit.canUpgradeAbility(ability)
    ) {
      throw errors.IncorrectArguments;
    }
    
    if (this._ctrl.user.crystals < unit.level.price) {
      throw errors.NotEnoughCurrency;
    }

    this._ctrl.user.debitCurrency(COMMODITY_COINS, unit.level.price);
    unit.upgradeAbility(ability);
    this.updateUnitState(unit);

    if (
      !this._ctrl.game.combatStarted
      &&
      this._ctrl.game.squadIncludesUnit(unit.unitId)
    ) {
      this._ctrl.game.proxyUnit(unit.unitId);
    }
  }
}
