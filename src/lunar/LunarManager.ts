import { Collection, ObjectId } from "mongodb";
import { Collections } from "../database/database";
import Game from "../game";

export class LunarManager {
  private _meta: any;
  private _saveCollection: Collection;
  private _craftingCollection: Collection;
  
  constructor() {
    this._saveCollection = Game.db.collection(Collections.LunarUsers);
    this._craftingCollection = Game.db.collection(Collections.CraftingRecipes);
  }

  async init() {
  }

  async loadProgress(userId: ObjectId) {
    return this._saveCollection.findOne({ _id: userId })
  }

  async getRecipes() {
    return this._craftingCollection.find({ category: 'lunar' })
  }

  async saveProgress(userId: ObjectId, saveData: any) {
    return this._saveCollection.updateOne({ _id: userId }, { $set: saveData }, { upsert: true });
  }

  getMeta() {
    return this._meta;
  }
}