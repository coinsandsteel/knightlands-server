import { ObjectId } from "mongodb";
import game from "../../game";
import events from "../../knightlands-shared/events";

export class MarchEvents {
    private _events: any;
    private _userId: ObjectId;

    constructor(userId: ObjectId) {
        this._userId = userId;
        this._events = {};
    }

    example(payload) {
      this._events.example = payload;
    }

    flush() {
        game.emitPlayerEvent(this._userId, events.MarchUpdate, this._events);
        this._events = {};
    }
}