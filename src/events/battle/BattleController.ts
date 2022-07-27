import _ from "lodash";
import Game from "../../game";
import * as battle from "../../../src/knightlands-shared/battle";
import User from "../../user";

import random from "../../random";
import { BattleEvents } from './BattleEvents';
import { BattleUser } from './BattleUser';
import { BattleGame } from './services/BattleGame';
import { BattleInventory } from './services/BattleInventory';
import { BattleSaveData } from './types';

const isProd = process.env.ENV == "prod";

export class BattleController {
  protected _saveData: BattleSaveData;

  protected _user: User;
  protected _events: BattleEvents;

  protected _battleUser: BattleUser;
  protected _battleGame: BattleGame;
  protected _battleInventory: BattleInventory;
  
  constructor(user: User) {
    this._events = new BattleEvents(user.id);
    this._user = user;
  }
  
  get events(): BattleEvents {
    return this._events;
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
  
  get rootUser(): User {
    return this._user;
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
    this._battleGame.dispose();
    await this._save();
  }

  protected initPlayer() {
    if (!this._battleUser) {
      this._battleUser = new BattleUser(
        this._saveData ? this._saveData.user : null, 
        this
      );
    }
  }
  
  protected initGame() {
    if (!this._battleGame) {
      this._battleGame = new BattleGame(
        this._saveData ? this._saveData.game : null, 
        this
      );
    }
  }

  protected initInventory() {
    if (!this._battleInventory) {
      this._battleInventory = new BattleInventory(
        this._saveData ? this._saveData.inventory : [], 
        this
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

  protected async _save() {
    await Game.battleManager.saveProgress(this._user.id, { state: this.getState() });
  }

  async load() {
    await this._battleUser.init();
    await this._battleGame.init();
    await this._battleInventory.init();
    
    const state = _.cloneDeep(this.getState());
    delete state.game.initiativeRating;
    return state;
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

  async fillSquadSlot(unitId: string, index: number) {
    this._battleGame.fillSquadSlot(unitId, index);
    this._events.flush();
  }
  
  async clearSquadSlot(index: number) {
    this._battleGame.clearSquadSlot(index);
    this._events.flush();
  }

  async upgradeUnitLevel(unitId: string) {
    this._battleInventory.upgradeUnitLevel(unitId);
    this._events.flush();
  }
  
  async upgradeUnitAbility(unitId: string, ability: string) {
    this._battleInventory.upgradeUnitAbility(unitId, ability);
    this._events.flush();
  }
  
  async chooseAbility(abilityclass: string) {
    this._battleGame.chooseAbility(abilityclass);
    this._events.flush();
  }

  async apply(index: number|null, ability: string|null) {
    this._battleGame.apply(index, ability);
  }

  async skip() {
    this._battleGame.skip();
    this._events.flush();
  }

  async enterLevel(room: number, level: number) {
    this._battleGame.enterLevel(room, level);
    this._events.flush();
  }
  
  async enterDuel(difficulty: string) {
    this._battleGame.enterDuel(difficulty);
    this._events.flush();
  }
  
  async getDuelOptions() {
    return this._battleGame.getDuelOptions();
  }
  
  async restart() {
    this._events.flush();
  }

  async exit() {
    this._battleGame.exit();
    this._events.flush();
  }

  async testAction(data) {
    if (isProd) return;
    switch (data.action) {
      case 'addUnit':{
        const tier = random.intRange(1, 3);
        const unit = this._battleInventory.getRandomUnit(tier);
        this._battleInventory.addUnit(unit);
        break;
      }
      case 'clearUnits':{
        this._battleGame.clearSquad();
        this._battleInventory.setUnits([]);
        break;
      }
      case 'increaseUnitExp':{
        this._battleInventory.addExp(data.unitId, 100);
        break;
      }
      case 'buildSquad':{
        this._battleGame.buildSquad();
        break;
      }
      case 'testAbilities':{
        this._battleGame.testAbilities();
        break;
      }
    }
    this._events.flush();
  }

}
