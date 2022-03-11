import { Collection, ObjectId } from "mongodb";
import _ from "lodash";

import Game from "../../game";
import { Collections } from "../../database/database";
import User from "../../user";
import errors from "../../knightlands-shared/errors";

const RANKS_PAGE_SIZE = 10;
export class AprilManager {
  private _meta: any;
  private _saveCollection: Collection;
  private _rankCollection: Collection;

  constructor() {
    this._saveCollection = Game.db.collection(Collections.AprilUsers);
    this._rankCollection = Game.db.collection(Collections.AprilRanks);
  }
  
  get eventStartDate() {
    return new Date(this._meta?.eventStartDate*1000 || '2021-04-01 00:00:00');
  }
  
  get eventEndDate() {
    return new Date(this._meta?.eventEndDate*1000 || '2022-04-14 00:00:00');
  }

  get eventRewards() {
    return this._meta.eventRewards || [];
  }

  get aprilTicketId() {
    return this._meta.aprilTicket;
  }

  async init() {
    this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "april_meta" });

    this._rankCollection = Game.db.collection(Collections.AprilRanks);
    this._rankCollection.createIndex({ maxSessionGold: 1 });
    this._rankCollection.createIndex({ order: 1 });
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
          receivedItems.push(_.cloneDeep(itemEntry));
        } else {
          receivedItems[receivedItemIndex].quantity += itemEntry.quantity;
        }
      });
    }
    
    await this._rankCollection.updateOne({ _id: user.id }, { $set: { claimed: 1 } });
    //console.log('[User rewards]', user.id, receivedItems);

    return receivedItems;
  }

  async updateRank(userId: ObjectId, points: number) {
    if (this.eventFinished()) {
      return;
    }
    await this._rankCollection.updateOne(
        { _id: userId },
        {
            $set: {
                order: Game.now
            },
            $max: {
                maxSessionGold: points
            },
        },
        { upsert: true }
    );
  }

  async getRankings() {
    const page = 0;

    const records = await this._rankCollection.aggregate([
        { $sort: { maxSessionGold: -1, order: 1 } },
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
                score: { $convert: { input: "$maxSessionGold", to: "string" } }
            }
        },
        {
            $project: { _id: 0 }
        }
    ]).toArray();

    return records;
  }

  async getUserRank(userId: string) {
    let userRecord = await this._rankCollection.findOne({ _id: userId });
    if (!userRecord || !userRecord.maxSessionGold) {
        return null;
    }

    let rank = await this._rankCollection.find({ 
      maxSessionGold: { $gt: userRecord.maxSessionGold } 
    }).count() + 1;

    //console.log('[User rank]', { userId, rank });

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
}