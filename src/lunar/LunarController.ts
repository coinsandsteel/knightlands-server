import User from "../user";
import Game from "../game";
import { LunarUser } from "./LunarUser";
import { LunarEvents } from "./LunarEvents";
import { LunarSaveData, LunarState } from "./types";

export class LunarController {
  private _user: User;
  private _lunarUser: LunarUser;
  private _saveData: LunarSaveData;
  private _events: LunarEvents;

  constructor(user: User) {
    this._events = new LunarEvents(user.id);
    this._user = user;
  }

  async init() {
    const saveData = await Game.lunarManager.loadProgress(this._user.id);
    if (saveData) {
      this._saveData = saveData as LunarSaveData;
    }
    
    this.initPlayer();
    if (!this._saveData) {
      this.generate();
    }

    await this._save();
  }

  async generate() {
    this._saveData = { state: this._lunarUser.getState() };
  }

  async dispose() {
    await this._save();
  }

  private initPlayer() {
    if (!this._lunarUser) {
      this._lunarUser = new LunarUser(
        this._saveData ? this._saveData.state : null, 
        this._events,
        this._user
      );
    }
  }


  getState(): LunarState {
    return this._lunarUser.getState();
``}

  private async _save() {
    await Game.lunarManager.saveProgress(this._user.id, { state: this.getState() });
  }
}
