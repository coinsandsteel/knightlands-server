import _ from "lodash";
import { Collection, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import Game from "../../game";
import { TICKET_ITEM_ID } from "../../knightlands-shared/march";

const PAGE_SIZE = 10;

export class MarchManager {
  private _meta: any;
  private _saveCollection: Collection;
  private _rankCollection: Collection;

  constructor() {
    this._saveCollection = Game.db.collection(Collections.MarchUsers);
    this._rankCollection = Game.db.collection(Collections.MarchRanks);
  }
  
  get eventStartDate() {
    return '2021-03-08 00:00:00';
  }
  
  get eventEndDate() {
    return '2022-03-14 23:59:59';
  }

  get raidRewardCount() {
    return 1;
  }

  get shopMeta() {
    return this._meta.shop;
  }

  get pools() {
    return this._meta.pools;
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
    const setOnInsert = { score1: 0, score2: 0, score3: 0, score4: 0, score5: 0 };
    delete setOnInsert[scorePetStr];
    await this._rankCollection.updateOne(
        { _id: userId },
        {
            $setOnInsert: setOnInsert,
            $set: {
                order: Game.now
            },
            $inc: {
                [scorePetStr]: points
            },
        },
        { upsert: true }
    );
  }

  async totalPlayers() {
    return this._rankCollection.find({}).count();
  }

  async getRankings() {
    const result = [];
    for (var i = 1; i <= 5; i++) {
      result.push(await this.getRanking(i));
    }

    return result;
  }

  async getRanking(petClass: number) {
    const scorePetStr = 'score' + petClass;
    const page = 0;

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

    return records;
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