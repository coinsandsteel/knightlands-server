import _ from 'lodash'
import User from "../../user";
import Game from "../../game";

import { MarchUser } from "./MarchUser";
import { MarchMap } from "./MarchMap";
import { MarchEvents } from "./MarchEvents";
import { MarchSaveData } from "./types";
import { TICKET_ITEM_ID } from '../../knightlands-shared/march';
import Errors from '../../knightlands-shared/errors';

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
      this._saveData = saveData.state as MarchSaveData;
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
    this._marchMap.exit(false);
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

  async purchaseGold(currency: string, amount: number) {
    this._marchUser.purchaseGold(currency, amount);
    this._events.flush();
  }
  
  async purchasePreGameBooster(type: string) {
    this._marchUser.purchasePreGameBooster(type);
    this._events.flush();
  }

  async tryToOpenChest(keyNumber: number) {
    this._marchMap.tryToOpenChest(keyNumber);
    this._events.flush();
  }

  async startNewGame() {
    this._marchUser.debitTicket();
    this._marchMap.restart();
    this._events.flush();
  }

  async exitGame() {
    this._marchMap.exit(true);
    this._events.flush();
  }

  async touch(index: number) {
    this._marchMap.touch(index);
    this._events.flush();
  }

  async collectDailyReward() {
    await this._marchUser.collectDailyMarchReward();
  }

  async testAction(action) {
    await this._marchUser.testAction(action);
  }

  async unlockPet(petClass: number) {
    await this._marchUser.unlockPet(petClass);
    this._events.flush();
  }

  async upgradePet(petClass: number) {
    await this._marchUser.upgradePet(petClass);
    this._events.flush();
  }
}
