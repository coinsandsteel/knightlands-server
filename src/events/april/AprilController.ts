import _ from 'lodash'
import User from "../../user";
import Game from "../../game";

import { AprilMap } from "./AprilMap";
import { AprilEvents } from './AprilEvents';
import { AprilSaveData } from './types';
import { AprilUser } from './AprilUser';

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
    const saveData = await Game.marchManager.loadProgress(this._user.id);
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
      map: this._aprilMap.getState(),
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

  async collectDailyReward() {
    await this._aprilUser.collectDailyAprilReward();
  }

  async claimRewards() {
    const items = await Game.aprilManager.claimRewards(this._user);
    return items;
  }
}
