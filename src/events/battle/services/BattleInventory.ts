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
  
  public async init() {
    this.createUnits();
  }

  protected createUnits(): void {
    this._units = [];
    this._state.forEach((unit: BattleInventoryUnit) => {
      this._units.push(new Unit(unit));
    });
  }
  
  getState(): BattleInventoryUnit[] {
    return this._state;
  }
  
  public getRandomUnit(tier?: number): Unit {
    // Get random unit blueprint
    const unitBlueprint = _.cloneDeep(_.sample(UNITS));
    unitBlueprint.tier = tier || null;
    // Construct unit
    const unit = new Unit(unitBlueprint);
    return unit;
  }

  public async addUnit(unit: Unit) {
    // Search by template
    const index = this._units.findIndex(inventoryUnit => inventoryUnit.template === unit.template);

    console.log({
      _units: this._units,
      _state: this._state
    });

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

  // TODO add edit unit
  // TODO add merge units
}
