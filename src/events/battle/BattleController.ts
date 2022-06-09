import _ from 'lodash'
import User from "../../user";
import Game from "../../game";
import * as battle from "../../knightlands-shared/battle";

import { BattleSaveData } from './types';
import { BattleEvents } from './BattleEvents';
import { BattleUser } from './BattleUser';
import { BattleGame } from './services/BattleGame';
import { BattleInventory } from './services/BattleInventory';

const isProd = process.env.ENV == "prod";

export class BattleController {
  private _user: User;
  private _saveData: BattleSaveData;
  private _events: BattleEvents;
  
  private _battleUser: BattleUser;
  private _battleGame: BattleGame;
  private _battleInventory: BattleInventory;
  
  constructor(user: User) {
    this._events = new BattleEvents(user.id);
    this._user = user;
  }
  
  async init() {
    const saveData = await Game.battleManager.loadProgress(this._user.id);
    if (saveData) {
      this._saveData = saveData.state as BattleSaveData;
    }
    
    this.initPlayer();
    this.initGame();
    this.initInventory();
    
    if (!this._saveData) {
      this.generate();
    }
  }

  async generate() {
    this._saveData = this.getState();
  }

  async dispose() {
    await this._save();
  }

  private initPlayer() {
    if (!this._battleUser) {
      this._battleUser = new BattleUser(
        this._saveData ? this._saveData.user : null, 
        this._events,
        this._user
      );
    }
  }
  
  private initGame() {
    if (!this._battleGame) {
      this._battleGame = new BattleGame(
        this._saveData ? this._saveData.game : null, 
        this._events,
        this._battleUser,
        this._user
      );
    }
  }

  private initInventory() {
    if (!this._battleInventory) {
      this._battleInventory = new BattleInventory(
        this._saveData ? this._saveData.inventory : [], 
        this._events,
        this._battleUser,
        this._user
      );
    }
  }

  getState(): BattleSaveData {
    return {
      user: this._battleUser.getState(),
      game: this._battleGame.getState(),
      inventory: this._battleInventory.getState()
    };
  }

  private async _save() {
    await Game.battleManager.saveProgress(this._user.id, { state: this.getState() });
  }

  async load() {
    await this._battleUser.init();
    await this._battleGame.init();
    await this._battleInventory.init();
    return this.getState();
  }

  async claimReward(type: string) {
    let items;
    switch (type) {
      case battle.REWARD_TYPE_DAILY: {
        await this._battleUser.claimDailyReward();
        break;
      }
      case battle.REWARD_TYPE_RANKING: {
        items = await Game.battleManager.claimRankingRewards(this._user);
        break;
      }
      case battle.REWARD_TYPE_SQUAD: {
        items = await this._battleUser.claimSquadReward();
        break;
      }
    }
    this._events.flush();
    return items;
  }

  async purchase(commodity: string, currency: string, shopIndex: number) {
    this._battleUser.purchase(commodity, currency, shopIndex);
    this._events.flush();
  }

  async enterLevel(room: number, level: number) {
    this._battleGame.enterLevel(room, level);
    this._events.flush();
  }
  
  async apply(unitId: string, index: number, ability?: string) {
    this._battleGame.apply(unitId, index, ability);
    this._events.flush();
  }

  async skip() {
    this._battleGame.skip();
    this._events.flush();
  }

  async testAction(data) {
    if (isProd) return;
    switch (data.action) {
      case 'addUnit':{
        const unit = this._battleInventory.getRandomUnit();
        await this._battleInventory.addUnit(unit);
        break;
      }
      case 'increaseUnitExp':{
        // unitId
        break;
      }
      case 'decreaseUnitExp':{
        // unitId
        break;
      }
      case 'increaseAbilityLevel':{
        // unitId
        // abilityClass
        break;
      }
      case 'decreaseAbilityLevel':{
        // unitId
        // abilityClass
        break;
      }
    }
    await this._battleUser.testAction(data);
    this._events.flush();
  }

  async exit() {
    this._battleGame.exit();
    this._events.flush();
  }
}
