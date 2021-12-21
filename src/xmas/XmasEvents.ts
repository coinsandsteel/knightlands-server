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
          tier,
          progress
        };
    }

    cycleLength(tier, cycleLength) {
        this._events.cycleLength = {
          tier,
          cycleLength
        };
    }

    upgrade(tier, upgrade) {
        this._events.upgrade = {
          tier,
          upgrade
        };
    }

    income(tier, current, next) {
      this._events.income = {
        tier,
        current,
        next
      };
    }

    branch(currency, unlocked) {
        this._events.branch = {
          currency,
          unlocked
        };
    }

    perk(currency, tiers) {
        this._events.perk = {
          currency,
          tiers
        };
    }

    cycleFinished(tier) {
        this._events.cycleFinished = { tier };
    }

    epochFinished(tier) {
        this._events.epochFinished = { tier };
    }
}