import { ObjectId } from "mongodb";

import game from "../../game";
import events from "../../knightlands-shared/events";

export class BattleEvents {
  private _events: any;
  private _userId: ObjectId;

  constructor(userId: ObjectId) {
      this._userId = userId;
      this._events = {};
  }

  flush() {
    game.emitPlayerEvent(this._userId, events.BattleUpdate, this._events);
    this._events = {};
  }
}
