import _ from "lodash";
import { LunarEvents } from "./LunarEvents";
import { LunarItem, LunarState } from "./types";
import User from "../user";
import Game from "../game";
import Errors from "../knightlands-shared/errors";
import { Collections } from "../database/database";
import Random from "../random";
import CurrencyType from "../knightlands-shared/currency_type";

const Config = require("../config");
const bounds = require("binary-search-bounds");

const ITEM_TYPE_LUNAR_RESOURCE = 'lunarResource';
const DAILY_REWARD_BASE = 4;

export class LunarUser {
    private _state: LunarState;
    private _events: LunarEvents;
    private _user: User;
    private _recipiesCached = {};
    private _allItems = [];
    private day = 1;

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
      await this._cacheRecipies();
      await this._cacheItems();
      this.distributeDailyRewards();
    }

    // TODO test
    // TODO add one test recept
    public async craft(items) {
      const cachedRecipieKey = items
        .map(item => item.info.caption)
        .sort()
        .join('');

      const recipe = this._recipiesCached[cachedRecipieKey];
      if (!recipe) {
        return;
      }

      const result = await this._user.crafting.craftRecipe(recipe.id, CurrencyType.Soft, 0);
      return result;
    }

    public async exchange(items) {
      if (items.length !== 2) {
        return;
      }

      if (items[0].rarity !== items[1].rarity) {
        return;
      }

      const itemsFilteredByCategory = this._allItems.filter(item => item.rarity === items[0].rarity);

      let randomItem = null;
      let haveItemInInventory = false;
      do {
        randomItem = _.sample(itemsFilteredByCategory);
        haveItemInInventory = this._user.inventory._items.findIndex(
          existingItem => existingItem.caption == randomItem.caption
        ) !== -1;
      } while (haveItemInInventory);

      await this._user.inventory.addItemTemplates([
        { item: randomItem.template, quantity: 1 }
      ]);

      this._events.newItem(_.pick(randomItem, ['caption', 'icon', 'quantity', 'rarity', 'template', '_id']));
      this._events.flush();
    }

    public getState(): LunarState {
      return this._state;
    }

    getRandomItems(count) {
      return _.sampleSize(this._allItems, count);
    }

    public async testAction(action) {
      switch (action) {
        case 'clearInventory':{
          for (let templateId in this._user.inventory._itemsByTemplate) {
            if (parseInt(templateId) >= 3214) {
              this._user.inventory.removeItemByTemplate(templateId, 1000);
            }
          }
          break;
        }
        case 'addTestItems':{
          const choosedItems = this.getRandomItems(10);
          const choosedItemsTemplates = choosedItems.map(item => ({ item: item.template, quantity: 1 }));
          await this._user.inventory.addItemTemplates(choosedItemsTemplates);
          break;
        }
        case 'resetDailyRewards':{
          this.day = 1;
          this._state.dailyRewards = this.getInitialDailyrewards();
          this.distributeDailyRewards();
          break;
        }
        case 'plus1Day':{
          this.day++;
          this.distributeDailyRewards();
          break;
        }
      }
    }

    getInitialDailyrewards() {
      const entries = [];
      for (let day = 1; day <= 7; day++) {
        entries.push({
          collected: false,
          active: false,
          quantity: day * DAILY_REWARD_BASE,
          items: []
        });
      }
      return entries;
    }

    async distributeDailyRewards() {
      this._state.dailyRewards = this._state.dailyRewards.map((entry, index) => {
        const items = index < this.day && !entry.items.length ? this.getRandomItems(entry.quantity) : [];
        const newEntry = {
          ...entry,
          active: index+1 === this.day,
          items
        };
        return newEntry;
      });
      this._events.dailyRewards(this._state.dailyRewards);
      this._events.flush();
    }

    public setInitialState() {
      const state: LunarState = {
        dailyRewards: this.getInitialDailyrewards()
      };
      this._state = _.cloneDeep(state);
      this.distributeDailyRewards();
    }
    
    async collectDailyLunarReward() {
      const entry = this._state.dailyRewards[this.day - 1];
      const rewardItems = entry.items;
      if (!rewardItems.length) {
        return;
      }

      if (entry.collected) {
        throw Errors.DailyLunarRewardCollected;
      }

      const items = [];
      rewardItems.forEach(item => {
        items.push({ item: item.template, quantity: 1 });
      })

      await this._user.inventory.addItemTemplates(items);
      this._state.dailyRewards[this.day - 1].collected = true;

      this._events.dailyRewards(this._state.dailyRewards);
      this._events.flush();
    }

    private async _cacheRecipies() {
      const recipies = await Game.lunarManager.getRecipes();
      recipies.forEach(recipe => {
        let key = recipies[recipe._id].ingridients.sort().join('');
        this._recipiesCached[key] = recipe;
      })
    }

    private async _cacheItems() {
      const items = await Game.lunarManager.getItems();
      this._allItems = items.map(item => ({
        ...item,
        template: item._id
      }));
    }
}