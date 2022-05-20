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

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }

    this._userSquad = new BattleSquad(this._state.squads.user);
    this._enemySquad = new BattleSquad(this._state.squads.enemy);
  }

  // TODO
  protected setInitialState() {
    this._state = {
      room: 0, // 8
      difficulty: 0, // 0, 1
      level: 0, // 5 + 1
      isMyTurn: false,
      squads: {
        user: this._userSquad.getState(),
        enemy: this._enemySquad.getState()
      },
      terrain: []
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