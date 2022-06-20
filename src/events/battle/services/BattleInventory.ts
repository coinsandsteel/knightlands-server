import _ from "lodash";
import { COMMODITY_COINS } from "../../../knightlands-shared/battle";
import errors from "../../../knightlands-shared/errors";
import User from "../../../user";
import { BattleEvents } from "../BattleEvents";
import { BattleUser } from "../BattleUser";
import { BattleInventoryUnit } from "../types";
import { Unit } from "../units/Unit";
import { UNITS } from "./../meta"

export class BattleInventory {
  protected _user: User;
  protected _battleUser: BattleUser;
  protected _state: BattleInventoryUnit[];
  protected _events: BattleEvents;
  protected _units: Unit[];

  constructor(state: BattleInventoryUnit[], events: BattleEvents, battleUser: BattleUser, user: User) {
    this._user = user;
    this._battleUser = battleUser;
    this._state = state;
    this._events = events;
    this._state = state || [];
  }
  
  get events(): BattleEvents {
    return this._events;
  }
  
  public async init() {
    this.createUnits();
  }

  protected createUnits(): void {
    this._units = [];
    this._state.forEach((unit: BattleInventoryUnit) => {
      this._units.push(this.makeUnit(unit));
    });
  }
  
  protected makeUnit(unit: BattleInventoryUnit): Unit {
    return new Unit(unit, this);
  }
  
  getState(): BattleInventoryUnit[] {
    return this._state;
  }
  
  public getRandomUnit(tier?: number): Unit {
    // Get random unit blueprint
    const unitBlueprint = _.cloneDeep(_.sample(UNITS));
    unitBlueprint.tier = tier || null;
    // Construct unit
    const unit = this.makeUnit(unitBlueprint);
    return unit;
  }

  public async addUnit(unit: Unit) {
    // Search by template
    const index = this._units.findIndex(inventoryUnit => inventoryUnit.template === unit.template);

    // Add or increase quantity
    if (index === -1) {
      this._units.push(unit);
      this._state.push(unit.serialize());
      this._events.addUnit(unit);
    } else {
      this._units[index].updateQuantity(unit.quantity);
      this.updateUnitState(unit);
    }
  }

  public async setUnits(units: Unit[]) {
    this._units = units;
    this._state = this._units.map(unit => unit.serialize());
    this._events.inventory(units);
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
    this._events.updateUnit(unit);
  }

  public getUnitById(unitId: string): Unit|null {
    return this._units.find((inventoryUnit: Unit) => { 
      return inventoryUnit.unitId === unitId; 
    }) || null;
  }

  public getUnitByTemplate(template: number): Unit|null {
    return this._units.find((inventoryUnit: Unit) => inventoryUnit.template === template) || null;
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

    if (this._battleUser.coins < unit.level.price) {
      throw errors.NotEnoughCurrency;
    }

    this._battleUser.debitCurrency(COMMODITY_COINS, unit.level.price);
    unit.upgradeLevel();
    this.updateUnitState(unit);
  }

  public upgradeUnitAbility(unitId: string, ability: string): void {
    const unit = this.getUnitById(unitId);
    if (
      !unit
      ||
      !unit.upgradeAbility(ability)
    ) {
      throw errors.IncorrectArguments;
    }
    
    if (this._battleUser.crystals < unit.level.price) {
      throw errors.NotEnoughCurrency;
    }

    this._battleUser.debitCurrency(COMMODITY_COINS, unit.level.price);
    unit.upgradeAbility(ability);
    this.updateUnitState(unit);
  }
}
