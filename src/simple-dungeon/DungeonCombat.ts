import { DungeonUser } from "./DungeonUser";
import { MoveType } from "../knightlands-shared/dungeon_types";
import { CombatState, EnemyData } from "./types";

export class DungeonCombat {
    private _user: DungeonUser;
    private _state: CombatState;

    constructor(user: DungeonUser) {
        this._user = user;
    }

    start(enemy: EnemyData) {
        this._state = {
            turn: 0,
            playerHealth: this._user.health,
            enemyHealth: enemy.health,
            enemyId: enemy.id
        }

        return this._state;
    }

    load(state: CombatState) {
        this._state = state;
    }

    async resolveOutcome(moveType: number) {

    }
}