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
const BASE_ELEMENTS = [3214, 3215, 3216, 3217];

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
      const currentDate = new Date().toISOString().split("T")[0];
      const currentDayIndex = this._state.dailyRewards.findIndex(
        entry => entry.date && entry.date === currentDate
      );

      if (currentDayIndex !== -1) {
        this.day = currentDayIndex + 1;
        return;
      }

      const firstUncollectedDayIndex = this._state.dailyRewards.findIndex(
        entry => !entry.date && !entry.collected
      );
      this.day = firstUncollectedDayIndex + 1;
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

      let newItems = [];
      const result = await this._user.crafting.craftRecipe(recipe._id, CurrencyType.Soft, 1);
      if (result.recipe.resultItem) {
        this._state.usedRecipes.push(recipe._id);
        this._state.usedRecipes = _.uniq(this._state.usedRecipes);
        this._events.usedRecipes(this._state.usedRecipes);

        const newItemTemplate = await Game.itemTemplates.getTemplate(result.recipe.resultItem);
        const newItem = _.pick(newItemTemplate, ['caption', 'icon', 'quantity', 'rarity', 'template', '_id']);
        newItem.quantity = +newItem.quantity;
        newItem.template = newItem._id;
        this._events.newItem(newItem);
        this._events.flush();

        newItems.push({
          item: newItem.template,
          quantity: 1
        });
      }

      return newItems;
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
      return;

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
              item: BASE_ELEMENTS[0],
              quantity: 1
            },
            { 
              item: BASE_ELEMENTS[1],
              quantity: 1
            },
            { 
              item: BASE_ELEMENTS[2],
              quantity: 1
            },
            { 
              item: BASE_ELEMENTS[3],
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
      this._state.dailyRewards[this.day - 1].date = new Date().toISOString().split("T")[0];

      this._events.dailyRewards(this._state.dailyRewards);
      this._events.flush();
    }
    
    async purchase(shopIndex, itemsCount, currency) {
      // Retrieve meta
      // let meta = [{ quantity: 4, hard: 9999, flesh: 9999 }]
      let shopMeta = Game.lunarManager.shopMeta;
      let choosedShopOption = shopMeta[shopIndex];

      // Wrong metadata protection
      if (!choosedShopOption || !choosedShopOption.hard || !choosedShopOption.flesh) {
        throw Errors.IncorrectArguments;
      }

      // let itemsCount = { 1: 5, 2: 5, 3: 5, 4: 5 }
      itemsCount = _.pick(itemsCount, BASE_ELEMENTS);
      let totalItemsCount = _.sum(Object.values(itemsCount));
      if (!totalItemsCount || totalItemsCount > choosedShopOption.quantity) {
        throw Errors.IncorrectArguments;
      }

      // check balance
      let balance = 0;
      let price = Infinity;
      switch (currency) {
        case "hard": {
          balance = this._user.hardCurrency;
          price = choosedShopOption.hard;
          break;
        }
        case "flesh": {
          balance = this._user.dkt;
          price = choosedShopOption.flesh;
          break;
        }
        default: {
          return;
        }
      }
      if (balance < price) {
        throw Errors.IncorrectArguments;
      }

      // change balance
      if (currency === "hard") {
        this._user.addHardCurrency(-price);
      } else if (currency === "flesh") {
        this._user.addDkt(-price);
      }

      let addItems = [];
      for (let templateId in itemsCount) {
        if (+itemsCount[templateId] > 0) {
          addItems.push({ item: +templateId, quantity: +itemsCount[templateId] });
        }
      }
      await this._user.inventory.addItemTemplates(addItems);

      return addItems;
    }
}