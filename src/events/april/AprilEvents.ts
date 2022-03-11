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

  balance(currency, balance) {
    this._events.balance = { 
      ...this._events.balance,
      [currency]: balance
    };
    //console.log('Balance', { currency, balance });
  }

  flush() {
    game.emitPlayerEvent(this._userId, events.AprilUpdate, this._events);
    this._events = {};
  }
}