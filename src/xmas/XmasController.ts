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
import { balance, slots, perksTree as perks } from "../knightlands-shared/xmas";

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
        if (saveData) {
            this._saveData = saveData as XmasSaveData;
            this.initPlayer();
        }

        if (!this._saveData) {
            await this.generate();
        }

        await this.enter();
    }

    async enter() {
      await this.generate();
      await this._save();
    }

    async dispose() {
        // flush data
        await this._save()
    }

    async load() {
        return this.getState();
    }

    async generate() {
      let state = {
          levelGap: 1,
          tower: {
            level: 0,
            percentage: 0,
            exp: 0
          },
          slots,
          perks,
          balance
        };

        this._saveData = { state };
        await Game.xmasManager.saveProgress(this._user.id, this._saveData);
        
        return this.getState();
    }

    getState(): XmasState {
        const state: XmasState = {
          levelGap: 1,
          tower: {
            level: 0,
            percentage: 0,
            exp: 0
          },
          slots,
          perks,
          balance
        };

        return state;
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
        await Game.xmasManager.saveProgress(this._user.id, this._saveData);
    }
}