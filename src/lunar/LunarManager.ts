import _ from "lodash";
import { Collection, ObjectId } from "mongodb";
import { date } from "random-js";
import { Collections } from "../database/database";
import Game from "../game";
import { ITEM_RARITY_BASIC } from "../knightlands-shared/lunar";
import objectUtils from "../objectUtils";
import { LunarItem } from "./types";

const ITEM_TYPE_LUNAR_RESOURCE = 'lunarResource';
const RECIPE_CATEGORY_LUNAR = 'lunar';

export class LunarManager {
  private _meta: any;
  private _saveCollection: Collection;
  private _craftingCollection: Collection;

  private _recipiesCached = {};
  private _allItems = [];

  constructor() {
    this._saveCollection = Game.db.collection(Collections.LunarUsers);
    this._craftingCollection = Game.db.collection(Collections.CraftingRecipes);
  }
  
  get eventStartDate() {
    return this._meta.eventStartDate || '2022-01-20 00:00:00';
  }
  
  get eventEndDate() {
    return this._meta.eventEndDate || '2022-01-26 23:59:59';
  }

  get raidRewardCount() {
    return this._meta.raidReward;
  }

  async init() {
    this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "lunar_meta" });
    await this._cacheRecipies();
    await this._cacheItems();
  }

  getItem(template) {
    return this._allItems.find(item => item.template === template);
  }

  getRecipe(id) {
    return this._recipiesCached[id];
  }

  getRandomItems(count) {
    return _.sampleSize(this._allItems, count);
  }

  getRaidReward() {
    /*{
      item: 2984,
      quantity: 3,
      guaranteed: true,
    }*/
    let items = this.getSomeBaseItems(this.raidRewardCount);
    let loot = {};
    items.forEach(item => {
      if (!loot[item.id]) {
        loot[item.id] = {
          item: item.id,
          quantity: 1,
          guaranteed: true
        };
      } else {
        loot[item.id].quantity++;
      }
    });
    return Object.values(loot);
  }

  getSomeBaseItems(count) {
    const baseItems = this.getItemsByRarity(ITEM_RARITY_BASIC);

    let items = [];
    for (let i = 0; i < count; i++) {
      let newItem = _.cloneDeep(_.sample(baseItems));
      let index = items.findIndex(i => i.id === newItem._id);
      if (index === -1) {
        const item: LunarItem = {
          id: newItem._id,
          template: newItem._id,
          rarity: newItem.rarity,
          caption: newItem.caption,
          quantity: 1
        }
        items.push(item);
      } else {
        items[index].quantity++;
      }
    }

    return items;
  }

  getItemsByRarity(rarity) {
    return this._allItems.filter(item => item.rarity === rarity);
  }

  public eventIsInProgress() {
    let now = new Date();
    let start = new Date(this.eventStartDate);
    let end = new Date(this.eventEndDate);
    return now >= start && now <= end;
  }

  async loadProgress(userId: ObjectId) {
    return this._saveCollection.findOne({ _id: userId })
  }

  async getRecipes() {
    return this._craftingCollection.find({ category: RECIPE_CATEGORY_LUNAR }).toArray();
  }

  async getItems() {
    return Game.itemTemplates._items().find({ type: ITEM_TYPE_LUNAR_RESOURCE }).toArray();
  }

  async saveProgress(userId: ObjectId, saveData: any) {
    return this._saveCollection.updateOne({ _id: userId }, { $set: saveData }, { upsert: true });
  }

  getMeta() {
    return this._meta;
  }

  private async _cacheRecipies() {
    const recipies = await this.getRecipes();
    recipies.forEach(recipe => {
      let key = recipe.ingridients.map(item => item.itemId).sort().join('');
      this._recipiesCached[key] = recipe;
    })
  }

  private async _cacheItems() {
    const items = await this.getItems();
    this._allItems = items.map(item => ({
      ...item,
      template: item._id
    }));
  }
}