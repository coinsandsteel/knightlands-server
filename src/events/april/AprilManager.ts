import { Collection, ObjectId } from "mongodb";
import _ from "lodash";

import Game from "../../game";
import { Collections } from "../../database/database";
import User from "../../user";
import errors from "../../knightlands-shared/errors";

const RANKS_PAGE_SIZE = 10;
const RANKING_WATCHER_PERIOD_MILSECONDS = 900000; // 60 * 15 * 1000 (15 minutes)

export class AprilManager {
  private _meta: any;
  private _saveCollection: Collection;
  private _rankCollection: Collection;
  private _lastRankingsResetTimestamp: number;

  constructor() {
    this._saveCollection = Game.db.collection(Collections.AprilUsers);
    this._rankCollection = Game.db.collection(Collections.AprilRanks);
    this._lastRankingsResetTimestamp = this.currentDayStart;
  }
  
  get eventStartDate() {
    return new Date(this._meta?.eventStartDate*1000 || '2021-04-01 00:00:00');
  }
  
  get eventEndDate() {
    return new Date(this._meta?.eventEndDate*1000 || '2022-04-14 00:00:00');
  }

  get timeLeft() {
    let secondsLeft = this.eventEndDate.getTime()/1000 - Game.nowSec;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    return secondsLeft;
  }

  get eventRewards() {
    return this._meta.eventRewards || [];
  }

  get aprilTicketId() {
    return this._meta.aprilTicket;
  }

  get currentDayStart() {
    const currentDayStart = new Date();
    currentDayStart.setHours(0,0,0,0);
    return currentDayStart.getTime();
  }

  get meta() {
    return this._meta;
  }

  get lastReset() {
    return this._meta.lastReset;
  }

  async init() {
    this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "april_meta" });

    this._rankCollection = Game.db.collection(Collections.AprilRanks);
    this._rankCollection.createIndex({ maxSessionGold: 1 });
    this._rankCollection.createIndex({ order: 1 });

    if (!this.lastReset) {
      await this.setLastRankingsResetTimestamp(
        this.currentDayStart
      );
    }

    this.watchResetRankings();
  }

  public eventIsInProgress() {
    const now = new Date();
    const start = this.eventStartDate;
    const end = this.eventEndDate;
    return now >= start && now <= end;
  }

  public eventFinished() {
    const now = new Date();
    const end = this.eventEndDate;
    return now > end;
  }

  async loadProgress(userId: ObjectId) {
    return this._saveCollection.findOne({ _id: userId })
  }

  async saveProgress(userId: ObjectId, saveData: any) {
    return this._saveCollection.updateOne({ _id: userId }, { $set: saveData }, { upsert: true });
  }

  watchResetRankings() {
    setInterval(async () => {
      await this.commitResetRankings();
    }, RANKING_WATCHER_PERIOD_MILSECONDS);
  }

  async commitResetRankings() {
    const currentDayStart = this.currentDayStart;
    if (currentDayStart <= this._lastRankingsResetTimestamp) {
      return;
    }

    await Game.dbClient.withTransaction(async (db) => {
      await db.collection(Collections.AprilRanks).deleteMany({});
      await db.collection(Collections.Meta).updateOne(
        { _id: 'april_meta' },
        { $set: { lastReset: currentDayStart } },
        { upsert: true }
      );
    });
    this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "april_meta" });
    if (currentDayStart === this.lastReset) {
      this._lastRankingsResetTimestamp = currentDayStart;
    }
  }

  async setLastRankingsResetTimestamp(value: number) {
    this._lastRankingsResetTimestamp = value;

    await Game.db.collection(Collections.Meta).updateOne(
      { _id: 'april_meta' },
      { $set: { lastReset: value } },
      { upsert: true }
    );
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
    
    const userRecord = await this._rankCollection.findOne({ _id: user.id });
    const rewardClaimed = userRecord ? !!userRecord.claimed : false;

    const userClassRank = await Game.aprilManager.getUserRank(user.id);

    if (userClassRank && userClassRank >= 1 && userClassRank <= 10) {
      return !rewardClaimed;
    }

    return false;
  }

  async hasClaimedReward(user: User) {
    const userRecord = await this._rankCollection.findOne({ _id: user.id });
    return userRecord ? !!userRecord.claimed : false;
  }

  public async claimRewards(user: User) {
    if (!this.eventFinished()) {
      throw errors.IncorrectArguments;
    }

    const rewardClaimed = await this.hasClaimedReward(user);
    if (rewardClaimed) {
      throw errors.IncorrectArguments;
    }

    const eventRewards = this.eventRewards;

    const userClassRank = await Game.aprilManager.getUserRank(user.id);
    if (userClassRank === null) {
      return [];
    }

    let rewardIndex = null;
    if (userClassRank >= 1 && userClassRank <= 4) {
      rewardIndex = userClassRank - 1;
    } else if (userClassRank >= 5 && userClassRank <= 10) {
      rewardIndex = 4;
    } else {
      return [];
    }

    const rewardItems = eventRewards[rewardIndex].items;
    await user.inventory.addItemTemplates(rewardItems);
    
    await this._rankCollection.updateOne({ _id: user.id }, { $set: { claimed: 1 } });
    //console.log('[User rewards]', user.id, receivedItems);

    return rewardItems;
  }
}
