import _ from "lodash";
import { Collection, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import Game from "../../game";
import User from "../../user";
import errors from "../../knightlands-shared/errors";

const RANKS_PAGE_SIZE = 10;

export class MarchManager {
  private _meta: any;
  private _saveCollection: Collection;
  private _rankCollection: Collection;

  constructor() {
    this._saveCollection = Game.db.collection(Collections.MarchUsers);
    this._rankCollection = Game.db.collection(Collections.MarchRanks);
  }
  
  get eventStartDate() {
    return new Date(this._meta.eventStartDate*1000 || '2021-03-08 00:00:00');
  }
  
  get eventEndDate() {
    return new Date(this._meta.eventEndDate*1000 || '2022-03-23 00:00:00');
  }

  get timeLeft() {
    let secondsLeft = this.eventEndDate.getTime()/1000 - Game.nowSec;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    return secondsLeft;
  }

  get raidRewardCount() {
    return this._meta.raidRewardCount || 1;
  }

  get eventRewards() {
    return this._meta.eventRewards || [];
  }

  get levelRewards() {
    return this._meta.levelRewards || [];
  }

  get marchTicketId() {
    return this._meta.marchTicket;
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
    if (this.eventFinished()) {
      return;
    }

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
            $max: {
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
    for (let petClass = 1; petClass <= 5; petClass++) {
      result.push(await this.getRankingsByPetClass(petClass));
    }

    return result;
  }

  async getUserRank(userId: string, petClass: number) {
    let userRecord = await this._rankCollection.findOne({ _id: userId });
    let classKey = `score${petClass}`;
    let score = userRecord ? userRecord[classKey] : null;
    if (!score) {
        return null;
    }

    let rank = await this._rankCollection.find({ 
      [classKey]: { $gt: score } 
    }).count() + 1;

    console.log('[User rank]', { userId, petClass, rank });

    return rank;
  }

  async userHasRewards(user: User) {
    if (!this.eventFinished()) {
      return false;
    }
    
    let userRecord = await this._rankCollection.findOne({ _id: user.id });
    let rewardClaimed = userRecord ? !!userRecord.claimed : false;
    let hasRewards = false;

    for (let petClass = 1; petClass <= 5; petClass++) {
      const userClassRank = await Game.marchManager.getUserRank(user.id, petClass);
      if (userClassRank === null) {
        continue;
      }

      if (userClassRank >= 1 && userClassRank <= 10) {
        hasRewards = true;
        break;
      }
    }

    return !rewardClaimed && hasRewards;
  }

  async rewardClaimed(user: User) {
    let userRecord = await this._rankCollection.findOne({ _id: user.id });
    return userRecord ? !!userRecord.claimed : false;
  }

  public async claimRewards(user: User) {
    if (!this.eventFinished()) {
      throw errors.IncorrectArguments;
    }

    const rewardClaimed = await this.rewardClaimed(user);
    if (rewardClaimed) {
      throw errors.IncorrectArguments;
    }

    const eventRewards = this.eventRewards;
    let receivedItems = [];

    for (let petClass = 1; petClass <= 5; petClass++) {
      const userClassRank = await Game.marchManager.getUserRank(user.id, petClass);
      if (userClassRank === null) {
        continue;
      }

      let rewardIndex = null;
      if (userClassRank >= 1 && userClassRank <= 4) {
        rewardIndex = userClassRank - 1;
      } else if (userClassRank >= 5 && userClassRank <= 10) {
        rewardIndex = 4;
      } else {
        continue;
      }

      const rewardItems = eventRewards[rewardIndex].items;
      await user.inventory.addItemTemplates(rewardItems);
      
      rewardItems.forEach((itemEntry) => {
        let receivedItemIndex = receivedItems.findIndex((receivedItem) => receivedItem.item === itemEntry.item);
        if (receivedItemIndex === -1) {
          receivedItems.push(itemEntry);
        } else {
          receivedItems[receivedItemIndex].quantity += itemEntry.quantity;
        }
      });
    }

    await this._rankCollection.updateOne({ _id: user.id }, { $set: { claimed: 1 } });

    return receivedItems;
  }

  async getRankingsByPetClass(petClass: number) {
    const scorePetStr = 'score' + petClass;
    const page = 0;

    const records = await this._rankCollection.aggregate([
        { $sort: { [scorePetStr]: -1, order: 1 } },
        { $skip: page * RANKS_PAGE_SIZE },
        { $limit: RANKS_PAGE_SIZE },
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

  public getRaidReward() {
    return {
      item: this.marchTicketId,
      quantity: this.raidRewardCount,
      guaranteed: true
    };
  }

  public eventIsInProgress() {
    let now = new Date();
    let start = this.eventStartDate;
    let end = this.eventEndDate;
    return now >= start && now <= end;
  }

  public eventFinished() {
    let now = new Date();
    let end = this.eventEndDate;
    return now > end;
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