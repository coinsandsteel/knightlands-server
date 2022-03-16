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

  hourRewardClaimed(timestamp) {
    this._events.hourRewardClaimed = timestamp;
  }
  
  sessionResult(value) {
    this._events.sessionResult = value;
  }

  hp(value) {
    this._events.hp = value;
  }

  actionPoints(value) {
    this._events.actionPoints = value;
  }

  cardsInQueue(value) {
    this._events.cardsInQueue = value;
  }

  usedCards(value) {
    this._events.usedCards = value;
  }

  units(value) {
    this._events.units = value;
  }

  damage(value) {
    this._events.damage = value;
  }
 
  cards(value) {
    this._events.cards = value;
  }

  balance(currency, balance) {
    this._events.balance = { 
      ...this._events.balance,
      [currency]: balance
    };
    console.log('April Balance', { currency, balance });
  }

  heroes(entries) {
    this._events.heroes = entries;
    console.log('April heroes', { entries });
  }

  flush() {
    game.emitPlayerEvent(this._userId, events.AprilUpdate, this._events);
    this._events = {};
  }
}
