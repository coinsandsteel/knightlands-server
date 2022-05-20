import _ from "lodash";
import { BattleSquadBonus, BattleSquadState } from "../types";
import { Unit } from "../units/Unit";

export class BattleSquad {
  protected _state: BattleSquadState;
  protected _units: Unit[];
  protected _bonuses: BattleSquadBonus[];

  constructor(state: BattleSquadState|null) {
    this._state = state;

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
}
