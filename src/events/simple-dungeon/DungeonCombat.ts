import { DungeonUser } from "./DungeonUser";
import { MoveType, MoveWinTable } from "../../knightlands-shared/dungeon_types";
import { CombatState, EnemyData } from "./types";
import random from "../../random";
import Game from "../../game";
import { DungeonEvents } from "./DungeonEvents";

export const CombatOutcome = {
  EnemyWon: -1,
  PlayerWon: 1,
  NobodyWon: 0,
};

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
    };

    return this._state;
  }

  load(state: CombatState) {
    this._state = state;
  }

  resolveOutcome(playerMove: number, powerScaling: number) {
    const enemyData = Game.dungeonManager.getEnemyData(this._state.enemyId);
    const weightedRandom = (prob): number => {
      let i,
        sum = 0,
        r = Math.random();
      for (i in prob) {
        sum += prob[i];
        if (r <= sum) return parseInt(i);
      }
    }
    const enemyMove = weightedRandom(enemyData.moveScheme);

    const meta = Game.dungeonManager.getMeta();
    let bonus = 0;

    if (MoveWinTable[playerMove] == enemyMove) {
      if (this._user.mainHand) {
        if (meta.items[this._user.mainHand].move == playerMove) {
          bonus = meta.items[this._user.mainHand].modifier;
        }
      }

      // player win
      this._state.enemyHealth -= this.getFinalDamage(
        this._user.attack,
        enemyData.defense,
        1 + bonus
      );
      this._events.enemyHealth(this._state.enemyHealth);
    } else if (MoveWinTable[enemyMove] == playerMove || playerMove === -1) {
      if (this._user.offHand) {
        if (meta.items[this._user.offHand].move == enemyMove) {
          bonus = meta.items[this._user.offHand].modifier;
        }
      }

      // enemy win
      this._user.applyDamage(
        Math.round(
          this.getFinalDamage(enemyData.attack, this._user.defense, 1 - bonus) *
            powerScaling
        )
      );
    }

    this._events.combatStep(playerMove, enemyMove);

    if (this._user.health <= 0) {
      this._state.outcome = CombatOutcome.EnemyWon;
    }

    if (this._state.enemyHealth <= 0) {
      this._state.outcome = CombatOutcome.PlayerWon;
    }

    return {
      playerMove,
      enemyMove,
    };
  }

  private getFinalDamage(attack: number, defense: number, weaponBonus: number) {
    return Math.ceil(
      attack * (1 - (0.01 * defense) / (1 + 0.01 * defense)) * weaponBonus
    );
  }
}
