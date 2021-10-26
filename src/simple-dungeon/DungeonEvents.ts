import { ObjectId } from "mongodb";
import game from "../game";
import events from "../knightlands-shared/events";
import { Cell, CombatState, DungeonTrapTile } from "./types";

export class DungeonEvents {
    private _events: any;
    private _userId: ObjectId;

    constructor(userId: ObjectId) {
        this._userId = userId;
        this._events = {};
    }

    flush() {
        game.emitPlayerEvent(this._userId, events.SDungeonUpdate, this._events);
        this._events = {};
    }

    // EVENTS
    cellRevealed(cell: Cell) {
        this._events.cell = cell;
    }

    energyChanged(value: number) {
        this._events.energy = value;
    }

    combatStarted(combat: CombatState) {
        this._events.combat = combat;
    }

    enemyHealth(newHealth: number) {
        this._events.enemyHealth = newHealth;
    }

    playerHealth(newHealth: number) {
        this._events.playerHealth = newHealth;
    }

    playerMoved(cellId: number) {
        this._events.moveTo = cellId;
    }

    altarApplied() { }

    trapActivated() { }

    trapJammed() {
        this._events.jammed = true;
    }

    lootAcquired() { }
}