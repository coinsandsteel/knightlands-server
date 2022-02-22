import _ from "lodash";
import { Collection, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import Game from "../../game";
import { TICKET_ITEM_ID } from "../../knightlands-shared/march";
import { MarchItem } from "./types";

const PAGE_SIZE = 50;
export class MarchManager {
  private _meta: any;
  private _saveCollection: Collection;
  private _rankCollection: Collection;

  constructor() {
    this._saveCollection = Game.db.collection(Collections.MarchUsers);
    this._rankCollection = Game.db.collection(Collections.MarchRanks);
  }
  
  get eventStartDate() {
    return this._meta.eventStartDate * 1000 || '2022-03-08 00:00:00';
  }
  
  get eventEndDate() {
    return this._meta.eventEndDate * 1000 || '2022-03-14 23:59:59';
  }

  get raidRewardCount() {
    return 1;
  }

  get shopMeta() {
    return this._meta.shop;
  }

  async init() {
    this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "march_meta" });
    this._rankCollection = Game.db.collection(Collections.MarchRanks);
    this._rankCollection.createIndex({ score1: 1 });
    this._rankCollection.createIndex({ score2: 1 });
    this._rankCollection.createIndex({ score3: 1 });
    this._rankCollection.createIndex({ score4: 1 });
    this._rankCollection.createIndex({ score5: 1 });
    this._rankCollection.createIndex({ order: 1 });
  }

  async updateRank(userId: ObjectId, petClass: number, points: number) {
    const scorePetStr = 'score' + petClass;
    await this._rankCollection.updateOne(
        { _id: userId },
        {
            $set: {
                order: Game.now,
                [scorePetStr]: points
            }
        },
        { upsert: true }
    );
  }

  async getUserRank(userId: ObjectId, petClass: number) {
    let userRecord = await this._rankCollection.findOne({ _id: userId });
    const scorePetStr = 'score' + petClass;
    let score = userRecord ? userRecord[scorePetStr] : null;
    if (!score) {
        return null;
    }

    let rank = await this._rankCollection.find({ [scorePetStr]: { $gt: score } }).count() + 1;
    return {
        rank,
        id: userId.toString(),
        score: score.toString(),
        b: userRecord.b
    };
  }

  async totalPlayers() {
    return this._rankCollection.find({}).count();
  }

  async getRankings(page: number, petClass: number) {
    const total = await this.totalPlayers();
    const scorePetStr = 'score' + petClass;

    const records = await this._rankCollection.aggregate([
        { $sort: { [scorePetStr]: -1, order: 1 } },
        { $skip: page * PAGE_SIZE },
        { $limit: PAGE_SIZE },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        {
            $project: {
                id: "$_id",
                name: {
                    $ifNull: [{ $arrayElemAt: ["$user.character.name.v", 0] }, ""]
                },
                avatar: {
                    $ifNull: [{ $arrayElemAt: ["$user.character.avatar", 0] }, -1]
                },
                score: { $convert: { input: "$"+ scorePetStr, to: "string" } }
            }
        },
        {
            $project: { _id: 0 }
        }
    ]).toArray();

    return {
        records,
        finished: total <= page * PAGE_SIZE + PAGE_SIZE
    };
  }

  getRaidReward() {
    return {
      item: TICKET_ITEM_ID,
      quantity: this.raidRewardCount,
      guaranteed: true
    };
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

  async saveProgress(userId: ObjectId, saveData: any) {
    return this._saveCollection.updateOne({ _id: userId }, { $set: saveData }, { upsert: true });
  }

  getMeta() {
    return this._meta;
  }
}