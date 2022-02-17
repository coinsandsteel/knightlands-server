import _ from 'lodash'
import User from "../../user";
import Game from "../../game";

import { MarchUser } from "./MarchUser";
import { MarchMap } from "./MarchMap";
import { MarchEvents } from "./MarchEvents";
import { MarchSaveData } from "./types";

export class MarchController {
  private _user: User;
  private _saveData: MarchSaveData;
  private _events: MarchEvents;

  private _marchUser: MarchUser;
  private _marchMap: MarchMap;

  constructor(user: User) {
    this._events = new MarchEvents(user.id);
    this._user = user;
  }

  async init() {
    const saveData = await Game.marchManager.loadProgress(this._user.id);
    if (saveData) {
      this._saveData = saveData as MarchSaveData;
    }
    
    this.initPlayer();
    this.initMap();
    
    if (!this._saveData) {
      this.generate();
    }

    await this._save();
  }

  async generate() {
    this._saveData = this.getState();
  }

  async dispose() {
    await this._save();
  }

  private initPlayer() {
    if (!this._marchUser) {
      this._marchUser = new MarchUser(
        this._saveData ? this._saveData.user : null, 
        this._events,
        this._user
      );
    }
  }

  private initMap() {
    if (!this._marchMap) {
      this._marchMap = new MarchMap(
        this._saveData ? this._saveData.map : null, 
        this._events,
        this._marchUser,
        this._user
      );
    }
  }

  getState(): MarchSaveData {
    return {
      user: this._marchUser.getState(),
      map: this._marchMap.getState(),
    };
  }

  private async _save() {
    await Game.marchManager.saveProgress(this._user.id, { state: this.getState() });
  }

  async load() {
    await this._marchUser.init();
    await this._marchMap.init();
    return this.getState();
  }

  async purchasePreGameBooster(type: string) {
    this._marchUser.modifyPreGameBooster(type, 1);
    this._events.flush();
  }

  async tryToOpenChest(keyNumber: number) {
    this._marchMap.tryToOpenChest(keyNumber);
    this._events.flush();
  }

  async startNewGame() {
    // Debit one ticket

    // Start the card game from scratch
    this._marchMap.restart();
    this._events.flush();
  }

  async touch(index: number) {
    this._marchMap.touch(index);
    this._events.flush();
  }

  async collectDailyReward(action) {
    await this._marchUser.collectDailyLunarReward();
  }

  async testAction(action) {
    //await this._marchUser.testAction(action);
  }

  async purchase(data) {
    
  }

  async gameOver() {
    this._marchMap.gameOver();
    this._events.flush();
  }
}
