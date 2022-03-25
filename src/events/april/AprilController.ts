import _ from 'lodash'
import User from "../../user";
import Game from "../../game";

import { AprilMap } from "./AprilMap";
import { AprilEvents } from './AprilEvents';
import { AprilSaveData } from './types';
import { AprilUser } from './AprilUser';
import * as april from "../../knightlands-shared/april";

export class AprilController {
  private _user: User;
  private _saveData: AprilSaveData;
  private _events: AprilEvents;

  private _aprilUser: AprilUser;
  private _aprilMap: AprilMap;

  constructor(user: User) {
    this._events = new AprilEvents(user.id);
    this._user = user;
  }

  async init() {
    const saveData = await Game.aprilManager.loadProgress(this._user.id);
    if (saveData) {
      this._saveData = saveData.state as AprilSaveData;
    }
    
    this.initPlayer();
    this.initMap();
    
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
    if (!this._aprilUser) {
      this._aprilUser = new AprilUser(
        this._saveData ? this._saveData.user : null, 
        this._events,
        this._user
      );
    }
  }
  
  private initMap() {
    if (!this._aprilMap) {
      this._aprilMap = new AprilMap(
        this._saveData ? this._saveData.map : null, 
        this._events,
        this._aprilUser,
        this._user
      );
    }
  }

  getState(): AprilSaveData {
    return {
      user: this._aprilUser.getState(),
      map: this._aprilMap.getState()
    };
  }

  private async _save() {
    await Game.aprilManager.saveProgress(this._user.id, { state: this.getState() });
  }

  async load() {
    await this._aprilUser.init();
    await this._aprilMap.init();
    return this.getState();
  }

  async claimReward(type: string, heroClass?: string) {
    let items;
    switch (type) {
      case april.REWARD_TYPE_HOUR: {
        await this._aprilUser.claimHourReward();
        break;
      }
      case april.REWARD_TYPE_DAILY: {
        await this._aprilUser.claimDailyReward();
        break;
      }
      case april.REWARD_TYPE_RANKING: {
        items = await Game.aprilManager.claimRewards(this._user);
        break;
      }
      case april.REWARD_TYPE_HERO: {
        items = await this._aprilUser.claimHeroReward(heroClass);
        break;
      }
    }
    this._events.flush();
    return items;
  }

  async purchaseHero(heroClass: string) {
    this._aprilUser.purchaseHero(heroClass);
    this._events.flush();
  }

  async purchaseGold(shopIndex: number,currency: string) {
    this._aprilUser.purchaseGold(shopIndex, currency);
    this._events.flush();
  }
  
  async heroStat() {
    return this._aprilUser.getHeroStat();
  }
  
  async restart(heroClass: string) {
    this._aprilMap.restart(heroClass);
    this._events.flush();
  }
  
  async move(cardId: string, index: number) {
    this._aprilMap.move(cardId, index);
    this._events.flush();
  }
  
  async skip() {
    this._aprilMap.skip();
    this._events.flush();
  }
  
  async purchaseAction() {
    this._aprilMap.purchaseAction();
    this._events.flush();
  }
  
  async enterLevel(booster: string) {
    this._aprilMap.enterLevel(booster);
    this._events.flush();
  }
  
  async resurrect() {
    this._aprilMap.resurrect();
    this._events.flush();
  }
  
  async exit() {
    this._aprilMap.exit();
    this._events.flush();
  }
}
