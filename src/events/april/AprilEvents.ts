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

  hourReward(entry) {
    this._events.hourReward = entry;
  }

  heroRewards(entries) {
    this._events.heroRewards = entries
  }

  level(value) {
    this._events.level = value;
  }

  sessionResult(value) {
    this._events.sessionResult = value;
  }

  hp(value) {
    this._events.hp = value;
  }

  healing(value) {
    this._events.healing = value;
  }

  actionPoints(value) {
    this._events.actionPoints = value;
  }

  prices(key, value) {
    this._events.prices = { 
      ...this._events.prices,
      [key]: value
    };
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

  newCard(value) {
    this._events.newCard = value;
  }

  flush() {
    game.emitPlayerEvent(this._userId, events.AprilUpdate, this._events);
    this._events = {};
  }
}
