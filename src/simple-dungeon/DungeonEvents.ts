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
        this._events.combat = {
            enemyHealth: combat.enemyHealth,
            enemyId: combat.enemyId
        };
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

    combatStep(player: number, enemy: number) {
        this._events.cStep = { player, enemy };
    }

    altarApplied() { }

    trapJammed() {
        this._events.jammed = true;
    }

    lootAcquired() { }
}