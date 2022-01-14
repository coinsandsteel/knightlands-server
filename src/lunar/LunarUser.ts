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
const ITEM_TYPE_LUNAR_RESOURCE = 'lunarResource';

export class LunarUser {
    private _state: LunarState;
    private _events: LunarEvents;
    private _user: User;
    private _recipiesCached = {};
    private _allItems = [];

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
      this._cacheRecipies();
      this._cacheItems();
    }

    public async craft(items) {
      const cachedRecipieKey = items
        .map(item => item.caption)
        .sort()
        .join('');

      const recipe = this._recipiesCached[cachedRecipieKey];
      if (!recipe) {
        return;
      }

      await Game.craftingQueue._craftRecipe(this._user.id, recipe.id, 0);
      
      this.syncItems();
    }

    public async exchange(items) {
      if (items.length !== 2) {
        return;
      }

      if (items[0].rarity !== items[1].rarity) {
        return;
      }

      if (this._state.items.length < 2) {
        return;
      }

      const itemsFilteredByCategory = this._allItems.filter(item => item.rarity === items[0].rarity);

      let randomItem = null;
      let haveItemInInventory = false;
      do {
        randomItem = _.sample(itemsFilteredByCategory);
        haveItemInInventory = this._state.items.findIndex(
          existingItem => existingItem.caption == randomItem.caption
        ) !== -1;
      } while (haveItemInInventory);

      this._user.addLoot([randomItem.template]);
      await this.syncItems();
    }

    public getState(): LunarState {
      return this._state;
    }

    public async addTestItems() {
      const choosedItems = _.sampleSize(this._allItems, 10);
      const choosedItemsTemplates = choosedItems.map(item => item.template);
      await this._user.addLoot(choosedItemsTemplates);
      await this.syncItems();
    }

    async syncItems() {
      this._state.items = await this.getFilteredInventory();
      this._events.items(this._state.items);
      this._events.flush();
    }

    async getFilteredInventory() {
      return await this._user.inventory
        .loadAllItems()
        .filter(item => item.type === ITEM_TYPE_LUNAR_RESOURCE);
    }

    public setInitialState() {
      const state: LunarState = {
        lunarRewardHistory: [],
        items: []
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
              // TODO adjust it, please
              /*items.push({
                  item: itemId,
                  quantity: 1
              } as LunarItem)*/
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

    private async _cacheRecipies() {
      const recipies = await Game.lunarManager.getRecipes();
      for (let recipe in recipies) {
        let key = recipies[recipe].ingridients.sort().join('');
        this._recipiesCached[key] = recipe;
      }
    }

    private async _cacheItems() {
      this._allItems = await Game.itemTemplates
        ._items()
        .findAll({ type: ITEM_TYPE_LUNAR_RESOURCE })
        .toArray();
    }
}