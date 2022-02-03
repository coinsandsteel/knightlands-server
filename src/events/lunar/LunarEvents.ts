import { ObjectId } from "mongodb";
import game from "../../game";
import events from "../../knightlands-shared/events";

export class LunarEvents {
    private _events: any;
    private _userId: ObjectId;

    constructor(userId: ObjectId) {
        this._userId = userId;
        this._events = {};
    }

    newItem(item) {
      this._events.newItem = item;
    }

    dailyRewards(entries) {
      this._events.dailyRewards = entries;
    }

    usedRecipes(entries) {
      this._events.usedRecipes = entries;
    }

    flush() {
        game.emitPlayerEvent(this._userId, events.LunarUpdate, this._events);
        this._events = {};
    }
}