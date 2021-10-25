import { DungeonEvents } from "./DungeonEvents";
import { AltarData, DungeonUserState } from "./types";

export class DungeonUser {
    private _state: DungeonUserState;
    private _events: DungeonEvents;

    constructor(state: DungeonUserState, events: DungeonEvents) {
        this._state = state;
        this._events = events;
    }

    get position() {
        return this._state.cell;
    }

    get health() {
        return 10000;
    }

    get defense() {
        return 200;
    }

    get attack() {
        return 10;
    }

    moveTo(cellId: number) {
        this._state.cell = cellId;
        this._events.playerMoved(cellId);
    }

    applyAltar(altar: AltarData) {

    }

    applyDamage(damage: number) {
        this._state.health -= damage;

        if (this._state.health < 0) {
            this._state.health = 0;
        }
    }
}