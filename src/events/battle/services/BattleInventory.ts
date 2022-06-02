import _ from "lodash";
import User from "../../../user";
import { BattleEvents } from "../BattleEvents";
import { BattleUser } from "../BattleUser";
import { BattleInventoryUnit } from "../types";

export class BattleInventory {
  private _user: User;
  private _state: BattleInventoryUnit[];
  private _events: BattleEvents;

  constructor(state: BattleInventoryUnit[], events: BattleEvents, battleUser: BattleUser, user: User) {
    this._user = user;
    this._state = state;
    this._events = events;
    this._state = state || [];
  }
  
  init(): void {
  }

  getState(): BattleInventoryUnit[] {
    return [];
  }

  // TODO add unit
  // TODO add edit unit
  // TODO add merge units
}
