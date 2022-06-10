import _ from "lodash";
import User from "../../../user";
import { BattleEvents } from "../BattleEvents";
import { BattleUser } from "../BattleUser";
import { BattleInventoryUnit } from "../types";
import { Unit } from "../units/Unit";
import { UNITS } from "./../meta"

export class BattleInventory {
  protected _user: User;
  protected _state: BattleInventoryUnit[];
  protected _events: BattleEvents;
  protected _units: Unit[];

  constructor(state: BattleInventoryUnit[], events: BattleEvents, battleUser: BattleUser, user: User) {
    this._user = user;
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
      this._events.updateUnit(unit);
    } else {
      this._units[index].updateQuantity(unit.quantity);
      this._events.updateUnit(unit);
    }

    // TODO sync
  }

  public async setUnits(units: Unit[]) {
    this._units = units;
    this._events.units(units);
  }

  public async addExp(unitId: string, value: number) {
    const unit = this.getUnitById(unitId);
    if (unit) {
      unit.addExpirience(value);
      this._events.updateUnit(unit);
    }
  }

  // TODO add edit unit
  // TODO add merge units

  public getUnitById(unitId: string): Unit|null {
    return this._units.find((inventoryUnit: Unit) => { 
      return inventoryUnit.unitId === unitId; 
    }) || null;
  }

  public getUnitByTemplate(template: number): Unit|null {
    return this._units.find((inventoryUnit: Unit) => inventoryUnit.template === template) || null;
  }
}
