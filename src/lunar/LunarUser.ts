import _ from "lodash";
import { LunarEvents } from "./LunarEvents";
import { LunarItem, LunarState } from "./types";
import User from "../user";
import Game from "../game";
import Errors from "../knightlands-shared/errors";
import { Collections } from "../database/database";
import Random from "../random";
const Config = require("../config");
const bounds = require("binary-search-bounds");

export class LunarUser {
    private _state: LunarState;
    private _events: LunarEvents;
    private _user: User;

    constructor(state: LunarState | null, events: LunarEvents, user: User) {
        this._events = events;
        this._user = user;

        if (state) {
          this._state = state;
        } else {
          this.setInitialState();
        }
    }

    public async init() {
      
    }

    public async craft(items) {

    }

    public async exchange(items) {

    }

    public getState(): LunarState {
      return this._state;
    }

    public setInitialState() {
      const state: LunarState = {
        lunarRewardHistory: []
      };
      this._state = _.cloneDeep(state);
    }

    private addLunarDailyReward(lunarItem: LunarItem[]) {
      this._state.lunarRewardHistory.push(lunarItem);
    }

    
    async collectDailyLunarReward() {
      const dailyLunarRewardsMeta = await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "lunar_meta" });
      const dailyLunarRewardCollect = this._processDailyLunarReward(dailyLunarRewardsMeta.lunarRewards);
      const rewardCount = dailyLunarRewardsMeta.dailyRewardBase * dailyLunarRewardCollect.step;
      const rewardItems = dailyLunarRewardsMeta.rewardItems;
      if (dailyLunarRewardCollect.cycle >= this.getDailyLunarRewardCycle()) {
          throw Errors.DailyLunarRewardCollected;
      }
      const itemIds = [];
      for(let i = 0; i < rewardCount; i++) {
          itemIds.push(rewardItems[Random.intRange(0, rewardItems.count)]);
      }

      const items = [];
      itemIds.forEach((itemId) => {
          const foundIndex = items.findIndex((it) => it.item === itemId)
          if (foundIndex !== -1) {
              items[foundIndex].quantity++;
          } else {
              items.push({
                  item: itemId,
                  quantity: 1
              } as LunarItem)
          }
      })

      await this._user.inventory.addItemTemplates(items);
      this.addLunarDailyReward(items);

      dailyLunarRewardCollect.cycle = this.getDailyLunarRewardCycle();
      dailyLunarRewardCollect.step++;

      this._user._data.dailyLunarRewardCollect = dailyLunarRewardCollect;

      return items;
    }
    
    _processDailyLunarReward(dailyLunarRewardsMeta) {
        const dailyLunarRewardCollect = this._user._data.dailyLunarRewardCollect;

        if (dailyLunarRewardCollect.step < 0 || dailyLunarRewardCollect.step >= dailyLunarRewardsMeta.length) {
            dailyLunarRewardCollect.step = 0;
        }

        return dailyLunarRewardCollect;
    }

    getDailyLunarRewardCycle() {
        return Math.floor(Game.now / Config.game.dailyLunarRewardCycle);
    }

    async getDailyLunarRewardStatus() {
      const dailyLunarRewardsMeta = (await Game.dbClient.db.collection(Collections.Meta).findOne({ _id: "lunar_meta" })).lunarRewards;
      const dailyLunarRewards = this._processDailyLunarReward(dailyLunarRewardsMeta);

      return {
          readyToCollect: dailyLunarRewards.cycle < this.getDailyLunarRewardCycle(),
          step: dailyLunarRewards.step,
          untilNext: Config.game.dailyLunarRewardCycle - Game.now % Config.game.dailyLunarRewardCycle
      };
  }
}