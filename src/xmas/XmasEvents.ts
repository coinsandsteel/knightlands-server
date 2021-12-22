import { ObjectId } from "mongodb";
import game from "../game";
import events from "../knightlands-shared/events";

export class XmasEvents {
    private _events: any;
    private _userId: ObjectId;

    constructor(userId: ObjectId) {
        this._userId = userId;
        this._events = {};
    }

    flush() {
        game.emitPlayerEvent(this._userId, events.XmasUpdate, this._events);
        this._events = {};
    }

    levelGap(value) {
        this._events.levelGap = value;
    }

    tower(data) {
        this._events.tower = data;
    }

    balance(currency, balance) {
        this._events.balance = { 
          [currency]: balance
        };
    }

    level(tier, level) {
        this._events.level = {
          tier,
          level
        };
    }

    accumulated(tier, currency, exp) {
        this._events.accumulated = {
          tier,
          accumulated: { currency, exp }
        };
    }

    progress(tier, progress) {
      this._events.progress = {
        ...this._events.progress,
        ...{ [tier]: progress }
      };
    }

    cycleLength(tier, cycleLength) {
      this._events.cycleLength = {
        ...this._events.cycleLength,
        ...{ [tier]: cycleLength }
      };
    }

    upgrade(tier, upgrade) {
        this._events.upgrade = {
          ...this._events.upgrade,
          ...{ [tier]: upgrade }
        };
    }

    income(tier, current, next) {
      this._events.income = {
        ...this._events.income,
        ...{ [tier]: { current, next } }
      };
    }

    branch(currency, unlocked) {
        this._events.branch = {
          currency,
          unlocked
        };
    }

    perks(perks) {
        this._events.perks = perks;
    }

    cycleStart(tier) {
        this._events.cycleStart = { tier };
    }

    cycleStop(tier) {
        this._events.cycleStop = { tier };
    }

    launched(tier, value) {
      this._events.launched = {
        ...this._events.launched,
        ...{ [tier]: value }
      };
    }
}