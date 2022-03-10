import { ObjectId } from "mongodb";

import game from "../../game";
import events from "../../knightlands-shared/events";

export class AprilEvents {
  private _events: any;
  private _userId: ObjectId;

  constructor(userId: ObjectId) {
      this._userId = userId;
      this._events = {};
  }

  dailyRewards(entries) {
    this._events.dailyRewards = entries;
  }

  flush() {
    game.emitPlayerEvent(this._userId, events.MarchUpdate, this._events);
    this._events = {};
  }
}