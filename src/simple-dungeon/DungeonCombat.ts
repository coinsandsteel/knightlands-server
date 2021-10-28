import { DungeonUser } from "./DungeonUser";
import { MoveWinTable } from "../knightlands-shared/dungeon_types";
import { CombatState, EnemyData } from "./types";
import random from "../random";
import Game from "../game";
import { DungeonEvents } from "./DungeonEvents";

export const CombatOutcome = {
    EnemyWon: -1,
    PlayerWon: 1,
    NobodyWon: 0
}

export class DungeonCombat {
    private _user: DungeonUser;
    private _state: CombatState;
    private _events: DungeonEvents;

    constructor(user: DungeonUser, events: DungeonEvents) {
        this._user = user;
        this._events = events;
    }

    get enemyId() {
        return this._state.enemyId;
    }

    get enemyHealth() {
        return this._state.enemyHealth;
    }

    get outcome() {
        return this._state.outcome;
    }

    start(id: number, health: number) {
        this._state = {
            outcome: CombatOutcome.NobodyWon,
            turn: 0,
            enemyHealth: health,
            enemyId: id,
            moveSetId: 0,
            moveIndex: 0
        }

        return this._state;
    }

    load(state: CombatState) {
        this._state = state;
    }

    resolveOutcome(playerMove: number) {
        // rotate enemy move
        const enemyData = Game.dungeonManager.getEnemyData(this._state.enemyId);

        if (this._state.moveSetId == 0) {
            // roll a new move set
            const enemyHealthRelative = this._state.enemyHealth / enemyData.health * 100;
            const moves = enemyData.moves.filter(x => x.minHealth <= enemyHealthRelative && x.maxHealth >= enemyHealthRelative);
            const moveSet = random.sampleWeighted(moves, 1)[0];
            this._state.moveSetId = moveSet.index;
        }

        const moveSet = enemyData.moves[this._state.moveSetId];
        const enemyMove = moveSet.sequence[this._state.moveIndex];
        this._state.moveIndex++;

        if (this._state.moveIndex == moveSet.sequence.length) {
            // end of sequence, roll new one next time
            this._state.moveSetId = 0;
            this._state.moveIndex = 0;
        }
        const meta = Game.dungeonManager.getMeta();
        let bonus = 0;

        if (MoveWinTable[playerMove] == enemyMove) {
            if (this._user.mainHand) {
                if (meta.items[this._user.mainHand].move == playerMove) {
                    bonus = meta.items[this._user.mainHand].modifier;
                }
            }

            // player win
            this._state.enemyHealth -= this.getFinalDamage(this._user.attack, enemyData.defense, bonus);
            this._events.enemyHealth(this._state.enemyHealth);
        } else if (MoveWinTable[enemyMove] == playerMove || playerMove === -1) {
            if (this._user.offHand) {
                if (meta.items[this._user.offHand].move == enemyMove) {
                    bonus = meta.items[this._user.offHand].modifier;
                }
            }

            // enemy win
            this._user.applyDamage(this.getFinalDamage(enemyData.attack, this._user.defense, bonus));
        }

        this._events.combatStep(playerMove, enemyMove);

        if (this._user.health <= 0) {
            this._state.outcome = CombatOutcome.EnemyWon;
        }

        if (this._state.enemyHealth <= 0) {
            this._state.outcome = CombatOutcome.PlayerWon;
        }
    }

    private getFinalDamage(attack: number, defense: number, weaponBonus: number) {
        return Math.ceil(attack * (1 - ((0.01 * defense) / (1 + 0.01 * defense))) * weaponBonus);
    }
}