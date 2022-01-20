import _ from "lodash";
import { LunarEvents } from "./LunarEvents";
import { LunarItem, LunarState } from "./types";
import User from "../user";
import Game from "../game";
import Errors from "../knightlands-shared/errors";
import { Collections } from "../database/database";
import Random from "../random";
import CurrencyType from "../knightlands-shared/currency_type";
import { ITEM_RARITY_EXPERT } from "../knightlands-shared/lunar";

const Config = require("../config");
const bounds = require("binary-search-bounds");

export class LunarUser {
    private _state: LunarState;
    private _events: LunarEvents;
    private _user: User;
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
      this.setEventDay();
      this.distributeDailyRewards();
    }

    private setEventDay() {
      const eventStart = new Date(Game.lunarManager.eventStartDate);
      const now = new Date();
      const oneDay = 1000 * 60 * 60 * 24;
      const diffInTime = now.getTime() - eventStart.getTime();
      const diffInDays = Math.round(diffInTime / oneDay);
      this.day = diffInDays < 1 ? 1 : diffInDays;
    }

    public async craft(payload) {
      let recipe = null;
      if (Array.isArray(payload)) {
        const cachedRecipieKey = payload
          .map(item => item.template)
          .sort()
          .join('');
        recipe = Game.lunarManager.getRecipe(cachedRecipieKey);
      } else if (payload.recipeId) {
        recipe = { _id: payload.recipeId };
      }

      if (!recipe) {
        return;
      }

      const result = await this._user.crafting.craftRecipe(recipe._id, CurrencyType.Soft, 1);
      if (result.recipe.resultItem) {
        this._state.usedRecipes.push(recipe._id);
        this._state.usedRecipes = _.uniq(this._state.usedRecipes);
        this._events.usedRecipes(this._state.usedRecipes);

        const newItem = Game.lunarManager.getItem(result.recipe.resultItem);
        this._events.newItem(_.pick(newItem, ['caption', 'icon', 'quantity', 'rarity', 'template', '_id']));
        this._events.flush();
      }
    }

    public async exchange(items) {
      if (items.length !== 2) {
        return;
      }

      if (items[0].rarity !== items[1].rarity) {
        return;
      }

      let itemsToRemove = {};
      items.forEach(item => {
        itemsToRemove[item.id] = itemsToRemove[item.id] || {
          item,
          count: 0
        };
        itemsToRemove[item.id].count++;
      });

      const rarity = items[0].rarity;
      const itemsFilteredByCategory = Game.lunarManager.getItemsByRarity(rarity);

      let randomItem = null;
      let haveItemInInventory = false;
      let limiter = 300;
      const lunarInventory = this._user.inventory._items.filter(inventoryItem => inventoryItem.template >= 3214);
      do {
        randomItem = _.sample(itemsFilteredByCategory);
        haveItemInInventory = lunarInventory.findIndex(
          existingItem => { 
            return existingItem.template === randomItem._id 
          }
        ) !== -1;
        limiter--;
      } while (haveItemInInventory && limiter);

      this._user.inventory.removeItems(Object.values(itemsToRemove));

      await this._user.inventory.addItemTemplates([
        { item: randomItem.template, quantity: 1 }
      ]);

      this._events.newItem(_.pick(randomItem, ['caption', 'icon', 'quantity', 'rarity', 'template', '_id']));
      this._events.flush();
    }

    public getState(): LunarState {
      return this._state;
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
        case 'addBaseItems':{
          await this._user.inventory.addItemTemplates([
            { 
              item: 3214,
              quantity: 1
            },
            { 
              item: 3215,
              quantity: 1
            },
            { 
              item: 3216,
              quantity: 1
            },
            { 
              item: 3217,
              quantity: 1
            },
          ]);
          break;
        }
        case 'addTestItems':{
          const choosedItems = Game.lunarManager.getRandomItems(10);
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
          quantity: day * Game.lunarManager.raidRewardCount,
          items: []
        });
      }
      return entries;
    }

    async distributeDailyRewards() {
      this._state.dailyRewards = this._state.dailyRewards.map((entry, index) => {
        const isCurrentDay = index+1 === this.day;
        let items = entry.items;
        if (isCurrentDay && !entry.items.length) {
          items = Game.lunarManager.getSomeBaseItems(entry.quantity);
        }
        const newEntry = {
          ...entry,
          active: isCurrentDay,
          items
        };
        return newEntry;
      });
      this._events.dailyRewards(this._state.dailyRewards);
      this._events.flush();
    }

    public setInitialState() {
      const state: LunarState = {
        dailyRewards: this.getInitialDailyrewards(),
        usedRecipes: []
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
        items.push({ item: item.template, quantity: +item.quantity });
      })

      await this._user.inventory.addItemTemplates(items);
      this._state.dailyRewards[this.day - 1].collected = true;

      this._events.dailyRewards(this._state.dailyRewards);
      this._events.flush();
    }
}