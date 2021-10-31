import { ObjectId } from "mongodb";
import game from "../game";
import events from "../knightlands-shared/events";
import { CombatOutcome } from "./DungeonCombat";
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
        if (!this._events.cell) {
            this._events.cell = [];
        }
        this._events.cell.push(cell);
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

    combatFinished(combat: CombatState) {
        this._events.combat = {
            outcome: combat.outcome
        }
    }

    enemyHealth(newHealth: number) {
        this._events.enemyHealth = newHealth;
    }

    enemyNotDefeated(cellId: number, health: number) {
        this._events.enemy = {
            cell: cellId,
            health
        };
    }

    enemyDefeated(cellId: number) {
        this._events.noEnemy = cellId;
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

    altarApplied(cellId: number) {
        this._events.altar = cellId;
    }

    trapJammed(cellId: number) {
        this._events.trap = cellId;
    }

    lootAcquired(cellId: number) {
        this._events.loot = cellId;
    }

    playerLevel(level: number) {
        this._events.level = level;
    }

    playerExp(exp: number) {
        this._events.exp = exp;
    }

    regenUpdate(data) {
        this._events.regen = data;
    }

    playerEquip({ mHand, oHand }) {
        this._events.equip = {
            mHand,
            oHand
        }
    }

    statsChanged(stats) {
        this._events.stats = stats;
    }
}