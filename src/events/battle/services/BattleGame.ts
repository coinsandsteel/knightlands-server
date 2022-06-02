import _ from "lodash";
import User from "../../../user";
import { BattleEvents } from "../BattleEvents";
import { BattleUser } from "../BattleUser";
import { BattleGameState } from "../types";
import { BattleSquad } from "./BattleSquad";

export class BattleGame {
  private _user: User;
  private _state: BattleGameState;
  private _events: BattleEvents;

  private _userSquad: BattleSquad;
  private _enemySquad: BattleSquad;

  constructor(state: BattleGameState|null, events: BattleEvents, battleUser: BattleUser, user: User) {
    this._user = user;
    this._state = state;
    this._events = events;

    this._userSquad = new BattleSquad(state ? state.userSquad : null);
    this._enemySquad = new BattleSquad(state ? state.enemySquad : null);

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }
  
  // TODO
  protected setInitialState() {
    this._state = {
      mode: null,
      room: null, // 8
      difficulty: null, // "low", "mudium", "hard"
      level: 0, // 5 + 1

      userSquad: this._userSquad.getState(),
      enemySquad: this._enemySquad.getState(),
      terrain: [],

      combat: {
        started: false,
        result: null, // "win" | "loose"
        isMyTurn: null,
        runtime: {
          unitId: null,
          selectedIndex: null,
          selectedAbilityClass: null,
          moveCells: [],
          attackCells: []
        }
      }
    } as BattleGameState;
  }

  public getState(): BattleGameState {
    return this._state;
  }

  // TODO
  public init(): void {
    this._userSquad.init();
    this._enemySquad.init();
  }
  
  // TODO
  public enterLevel(room: number, level: number): void {
    // Set room/level
    // Set difficulty
    // Set isMyTurn
    // Find an enemy
    // Load terrain
  }

  // TODO
  public apply(unitId: string, index: number, ability?: string): void {
    
  }
  
  public skip(): void {}

  public exit(): void {}
}