import _ from "lodash";
import { Collection } from "mongodb";
import { isNumber } from "../validation";
import Game from "../game";
import errors from "../knightlands-shared/errors";
import random from "../random";
import User from "../user";
import { XmasEvents } from "./XmasEvents";
import { XmasUser } from "./XmasUser";
import { XmasSaveData, XmasState } from "./types";
import { CURRENCY_SANTABUCKS, balance, slots, perksTree as perks, currencies } from "../knightlands-shared/xmas";

const IAP_TAG = "xmas";

export class XmasController {
    private _user: User;
    private _xmasUser: XmasUser;
    private _saveData: XmasSaveData;
    private _events: XmasEvents;

    constructor(user: User) {
        this._events = new XmasEvents(user.id);
        this._user = user;
    }

    async init() {
        const saveData = await Game.xmasManager.loadProgress(this._user.id);
        if (!this._saveData) {
          await this.generate();
        } else {
          this._saveData = saveData as XmasSaveData;
        }
        this.initPlayer();
        await this._save();
    }

    async dispose() {
        // flush data
        await this._save();
    }

    async load() {
        return this.getState();
    }

    async generate() {
        this._saveData = { state: XmasUser.getInitialState() };
    }

    getState(): XmasState {
        return this._xmasUser.getState();
    }

    async farmUpgrade(tier) {
      if (
        !this._xmasUser.upgradeIsAllowed(tier)
        ||
        !this._xmasUser.canAffordUpgrade(tier)
      ) {
        return;
      }
      
      this._xmasUser.upgradeSlot(tier);
      this._events.flush();
    }

    async harvest(tier) {
      this._xmasUser.harvest(tier);
      this._events.flush();
    }
    
    async commitPerks(perks) {
      this._xmasUser.commitPerks(perks);
      this._events.flush();
    }

    async updateLevelGap(value) {
      this._xmasUser.updateLevelGap(value);
      this._events.flush();
    }

    private initPlayer() {
        if (!this._xmasUser) {
            this._xmasUser = new XmasUser(this._saveData.state, this._events);
        }
    }

    private async increaseRank(points: number) {
        await Game.xmasManager.updateRank(this._user.id, points);
    }

    private async _save() {
        await Game.xmasManager.saveProgress(this._user.id, { state: this.getState() });
    }
}