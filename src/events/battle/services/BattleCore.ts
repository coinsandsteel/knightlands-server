import _ from "lodash";
import { ObjectId } from "mongodb";

import { BattleEvents } from './BattleEvents';
import { BattleUser } from './BattleUser';
import { BattleGame } from './BattleGame';
import { BattleInventory } from './BattleInventory';
import { BattleAdventuresState, BattleSaveData, BattleUnit } from '../types';
import { BattleGameState, BattleUserState } from "../types";
import { BattleAdventures } from "./BattleAdventures";
import User from "../../../user";

export class BattleCore {
  protected _user: User;
  protected _battleEvents: BattleEvents;
  protected _battleUser: BattleUser;
  protected _battleGame: BattleGame;
  protected _battleInventory: BattleInventory;
  protected _battleAdventures: BattleAdventures;

  constructor(user: User) {
    this._user = user;
    this._battleEvents = new BattleEvents(user.id);
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

  get adventures(): BattleAdventures {
    return this._battleAdventures;
  }

  get user(): BattleUser {
    return this._battleUser;
  }

  get gameUser(): User {
    return this._user;
  }

  public init(saveData?: BattleSaveData) {
    //console.log('Core init');
    this.initUser(saveData ? saveData.user : null);
    this.initInventory(saveData ? saveData.inventory : null);
    this.initGame(saveData ? saveData.game : null);
    this.initAdventures(saveData ? saveData.adventures : null);
  }

  protected initUser(saveData?: BattleUserState) {
    if (!this._battleUser) {
      this._battleUser = new BattleUser(saveData, this);
    }
  }

  protected initGame(saveData?: BattleGameState) {
    //console.log('Init game');
    if (!this._battleGame) {
      //console.log('Create game', saveData);
      this._battleGame = new BattleGame(saveData, this);
    }
  }

  protected initInventory(saveData?: BattleUnit[]) {
    if (!this._battleInventory) {
      this._battleInventory = new BattleInventory(saveData, this);
    }
  }

  protected initAdventures(saveData?: BattleAdventuresState) {
    if (!this._battleAdventures) {
      this._battleAdventures = new BattleAdventures(saveData, this);
    }
  }

  public getState(): BattleSaveData {
    return {
      user: this._battleUser.getState(),
      game: this._battleGame.getState(),
      inventory: this._battleInventory.getState(),
      adventures: this._battleAdventures.getState(),
    };
  }

  async load() {
    //console.log('BattleCore.load');
    await this._battleUser.load();
    await this._battleInventory.load();
    await this._battleGame.load();
    //console.log('BattleCore.loaded');
  }
}
