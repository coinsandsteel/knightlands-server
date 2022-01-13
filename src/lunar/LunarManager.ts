import { Collection, ObjectId } from "mongodb";
import { Collections } from "../database/database";
import Game from "../game";

export class LunarManager {
  private _meta: any;
  private _saveCollection: Collection;
  
  constructor() {
    this._saveCollection = Game.db.collection(Collections.LunarUsers);
  }

  async init() {
  }

  async loadProgress(userId: ObjectId) {
    return this._saveCollection.findOne({ _id: userId })
  }

  async saveProgress(userId: ObjectId, saveData: any) {
    return this._saveCollection.updateOne({ _id: userId }, { $set: saveData }, { upsert: true });
  }

  getMeta() {
    return this._meta;
  }
}