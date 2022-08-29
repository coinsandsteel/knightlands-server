import _ from "lodash";
import { ObjectId } from "mongodb";

import { BattleEvents } from './BattleEvents';
import { BattleUser } from './BattleUser';
import { BattleGame } from './BattleGame';
import { BattleInventory } from './BattleInventory';
import { BattleSaveData, BattleUnit } from '../types';
import { BattleGameState, BattleUserState } from "../types";

export class BattleCore {
  protected _battleEvents: BattleEvents;
  protected _battleUser: BattleUser;
  protected _battleGame: BattleGame;
  protected _battleInventory: BattleInventory;
  
  constructor(userId: ObjectId) {
    this._battleEvents = new BattleEvents(userId);
  }
  
  get events(): BattleEvents {
    return this._battleEvents;
  }
  
  get game(): BattleGame {
    return this._battleGame;
  }
  
  get inventory(): BattleInventory {
    return this._battleInventory;
  }
  
  get user(): BattleUser {
    return this._battleUser;
  }
  
  public init(saveData?: BattleSaveData) {
    this.initUser(saveData ? saveData.user : null);
    this.initGame(saveData ? saveData.game : null);
    this.initInventory(saveData ? saveData.inventory : null);
  }

  public dispose() {
    this.game.dispose();
  }

  protected initUser(saveData?: BattleUserState) {
    if (!this._battleUser) {
      this._battleUser = new BattleUser(saveData, this);
    }
  }
  
  protected initGame(saveData?: BattleGameState) {
    if (!this._battleGame) {
      this._battleGame = new BattleGame(saveData, this);
    }
  }

  protected initInventory(saveData?: BattleUnit[]) {
    if (!this._battleInventory) {
      this._battleInventory = new BattleInventory(saveData, this);
    }
  }

  getState(): BattleSaveData {
    return {
      user: this._battleUser.getState(),
      game: this._battleGame.getState(),
      inventory: this._battleInventory.getState()
    };
  }

  async load() {
    await this._battleUser.init();
    await this._battleGame.init();
    await this._battleInventory.init();
  }
}
