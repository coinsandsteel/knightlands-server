import _ from "lodash";
import { BattleSquadBonus, BattleSquadState } from "../types";
import { BattleController } from "../BattleController";
import { Unit } from "../units/Unit";
import errors from "../../../knightlands-shared/errors";

export class BattleSquad {
  protected _state: BattleSquadState;
  protected _ctrl: BattleController;

  protected _units: Unit[];
  protected _bonuses: BattleSquadBonus[];

  constructor(state: BattleSquadState|null, ctrl: BattleController) {
    this._state = state;
    this._ctrl = ctrl;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }
  
  public init() {
    // Properties
    // https://docs.google.com/spreadsheets/d/1BzNKygvM41HFggswJLnMWzaN3F4mI6D7iWpRMCEm_QM/edit#gid=1206803409
    // hp
    // damage
    // def
    // speed
    // initiative

    // Abilities
    // https://docs.google.com/spreadsheets/d/1BzNKygvM41HFggswJLnMWzaN3F4mI6D7iWpRMCEm_QM/edit#gid=1260018765
    this._units = [];
    
    // Apply squad bonuses
    // https://docs.google.com/spreadsheets/d/1BzNKygvM41HFggswJLnMWzaN3F4mI6D7iWpRMCEm_QM/edit#gid=1792408341
    this._bonuses = [];
  }
  
  protected setInitialState() {
    this._state = {
      power: 0,
      bonuses: [],
      units: []
    } as BattleSquadState;
  }
  
  public getState(): BattleSquadState {
    return this._state;
  }
  
  public fillSlot(unitId: string, index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw errors.IncorrectArguments;
    }
    
    const unit = this._ctrl.inventory.getUnitById(unitId) as Unit;
    if (!unit) {
      throw errors.IncorrectArguments;
    }

    // Fill slot
    this._units[index] = unit;
    
    // Update state
    this._state.units[index] = unit.serializeForSquad();

    // Update bonuses
    this.setBonuses();

    // Event
    this._ctrl.events.userSquad(this._state);
  }
  
  public clearSlot(index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw errors.IncorrectArguments;
    }
    
    // Fill slot
    this._units[index] = null;
    
    // Update state
    this._state.units[index] = null;

    // Update bonuses
    this.setBonuses();

    // Event
    this._ctrl.events.userSquad(this._state);
  }
  
  public proxyUnit(unitId: string): void {
    const index = this._units.findIndex(unitEntry => unitEntry.unitId === unitId)
    if (index === -1) {
      return;
    }

    this.fillSlot(unitId, index);
    this._ctrl.events.userSquad(this._state);
  }
  
  protected setBonuses(): void {

  }
  
  public includesUnit(unitId: string): boolean {
    return this._units.findIndex(unit => unit.unitId === unitId) !== -1;
  }
}
