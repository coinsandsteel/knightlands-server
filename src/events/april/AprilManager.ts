import { Collection, ObjectId } from "mongodb";
import _ from "lodash";

import Game from "../../game";
import User from "../../user";
import { Collections } from "../../database/database";
import errors from "../../knightlands-shared/errors";
import * as april from "../../knightlands-shared/april";
import random from "../../random";

const isProd = process.env.ENV == "prod";
const RANKS_PAGE_SIZE = 10;
const RANKING_WATCHER_PERIOD_MILSECONDS = 1 * 60 * 1000;

export class AprilManager {
  private _meta: any;
  private _saveCollection: Collection;
  private _rankCollection: Collection;
  private _rewardCollection: Collection;
  private _lastRankingsReset: number;

  constructor() {
    this._saveCollection = Game.db.collection(Collections.AprilUsers);
    this._rankCollection = Game.db.collection(Collections.AprilRanks);
    this._rewardCollection = Game.db.collection(Collections.AprilRewards);
  }
  
  get eventStartDate() {
    return new Date(this._meta.eventStartDate * 1000 || '2021-04-01 00:00:00');
  }
  
  get eventEndDate() {
    return new Date(this._meta.eventEndDate * 1000 || '2022-04-14 00:00:00');
  }

  get timeLeft() {
    let secondsLeft = this.eventEndDate.getTime()/1000 - Game.nowSec;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    return secondsLeft;
  }

  get resetTimeLeft() {
    let secondsLeft = this.nextMidnight/1000 - Game.nowSec;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    return secondsLeft;
  }

  get rankingRewards() {
    return this._meta.rankingRewards || [];
  }

  get heroRewards() {
    return this._meta.heroRewards || [];
  }

  get aprilTicketId() {
    return this._meta.aprilTicket || 3475;
  }

  get actionPriceBase() {
    return this._meta.actionPriceBase || 5;
  }

  get resurrectionPriceBase() {
    return this._meta.resurrectionPriceBase || 15;
  }

  get midnight() {
    const midnight = new Date();
    midnight.setHours(0,0,0,0);
    return midnight.getTime();
  }

  get nextMidnight() {
    const midnight = new Date();
    midnight.setHours(23,59,59,0);
    return midnight.getTime();
  }

  get meta() {
    return this._meta;
  }

  async init() {
    this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "april_meta" }) || {};
    if (!this._meta.aprilTicket || !this._meta.eventStartDate || !this._meta.eventEndDate) {
      console.error(`[AprilManager] WARNING! Meta is not loaded!`);
    }

    this._rankCollection.createIndex({ maxSessionGold: 1 });
    this._rankCollection.createIndex({ order: 1 });

    // Retrieve lastReset from meta. Once.
    // Since this moment we'll be updating memory variable only.
    this._lastRankingsReset = this._meta.lastReset || 0;
    console.log(`[AprilManager] Initial last reset`, { _lastRankingsReset: this._lastRankingsReset });

    if (!isProd) {
      await this._rankCollection.deleteMany({});
      await this.addTestRatings();
    }
    await this.watchResetRankings();
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

  async watchResetRankings() {
    setInterval(async () => {
      await this.commitResetRankings();
    }, RANKING_WATCHER_PERIOD_MILSECONDS);
  }

  async commitResetRankings() {
    const midnight = this.midnight;
    // Last reset was in midnight or earlier? Skip reset then.
    if (isProd && this._lastRankingsReset >= midnight) {
      //console.log(`[AprilManager] Rankings reset ABORT. _lastRankingsReset(${this._lastRankingsReset}) >= midnight(${midnight})`);
      return;
    }
    
    // Distribute rewards for winners
    this.distributeRewards();

    console.log(`[AprilManager] Rankings reset LAUNCH. _lastRankingsReset(${this._lastRankingsReset}) < midnight(${midnight})`);
    // Last reset was more that day ago? Launch reset.
    await Game.dbClient.withTransaction(async (db) => {
      await db.collection(Collections.AprilRanks).deleteMany({});
      await db.collection(Collections.Meta).updateOne(
        { _id: 'april_meta' },
        { $set: { lastReset: midnight } },
        { upsert: true }
      );
    });
      
    // Update reset time.
    // Meta was updated already. It's nothing to do with meta.
    this._lastRankingsReset = midnight;
    console.log(`[AprilManager] Rankings reset FINISH.`, { _lastRankingsReset: this._lastRankingsReset});

    if (!isProd) {
      await this.addTestRatings();
    }
  }

  async distributeRewards() {
    console.log(`[AprilManager] Rankings distribution LAUNCHED.`);

    for (let i = 0; i < april.HEROES.length; i++) {
      let heroClass = april.HEROES[i].heroClass;

      // Rankings page
      const heroClassRankings = await this.getRankingsByHeroClass(heroClass);
      for (let rankIndex = 0; rankIndex < heroClassRankings.length; rankIndex++) {
        let entry = heroClassRankings[rankIndex];
        await this.debitUserReward(entry.id, heroClass, rankIndex + 1);
      }
    }

    console.log(`[AprilManager] Rankings distribution FINISHED.`);
  }

  async debitUserReward(userId: ObjectId, heroClass: string, rank: number) {
    let rewardsEntry = await this._rewardCollection.findOne({ _id: userId }) || {};
    let items = rewardsEntry.items || [];

    let rewardIndex = null;
    if (rank >= 1 && rank <= 4) {
      rewardIndex = rank - 1;
    } else if (rank >= 5 && rank <= 10) {
      rewardIndex = 4;
    } else {
      return;
    }

    const rewardItems = this.rankingRewards[rewardIndex].items;
    
    rewardItems.forEach((itemEntry) => {
      let receivedItemIndex = items.findIndex((receivedItem) => receivedItem.item === itemEntry.item);
      if (receivedItemIndex === -1) {
        items.push(_.cloneDeep(itemEntry));
      } else {
        items[receivedItemIndex].quantity += itemEntry.quantity;
      }
    });

    await this._rewardCollection.updateOne(
      { _id: userId }, 
      { $set: { items, [`ranks.${heroClass}`]: rank }},
      { upsert: true }
    );

    console.log(`[AprilManager] Rankings rewards distributed.`, { userId, heroClass, rank, items });
  }

  async updateRank(userId: ObjectId, heroClass: string, points: number) {
    if (this.eventFinished()) {
      return;
    }

    const setOnInsert = april.HEROES.reduce(
      (previousValue, currentValue) => {
        previousValue[currentValue.heroClass] = 0
        return previousValue;
      },
      { }
    );
    delete setOnInsert[heroClass];
    await this._rankCollection.updateOne(
        { _id: userId },
        {
            $setOnInsert: setOnInsert,
            $set: {
                order: Game.now
            },
            $inc: {
                [heroClass]: points
            },
        },
        { upsert: true }
    );
  }

  async getRankings() {
    const result = [];
    for (let i = 0; i < april.HEROES.length; i++) {
      result.push(await this.getRankingsByHeroClass(april.HEROES[i].heroClass));
    }

    return result;
  }

  async getRankingsByHeroClass(heroClass: string) {
    const page = 0;

    const records = await this._rankCollection.aggregate([
        { $sort: { [heroClass]: -1, order: 1 } },
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
                score: { $convert: { input: "$" + heroClass, to: "string" } }
            }
        },
        {
            $project: { _id: 0 }
        }
    ]).toArray();

    return records;
  }

  public async userHasRewards(user: User) {
    const rewardsEntry = await this._rewardCollection.findOne({ _id: user.id });
    return rewardsEntry && rewardsEntry.items && rewardsEntry.items.length && !rewardsEntry.claimed;
  }

  public async claimRankingRewards(user: User) {
    const rewardsEntry = await this._rewardCollection.findOne({ _id: user.id });
    if (!rewardsEntry || !rewardsEntry.items.length || rewardsEntry.claimed) {
      throw errors.IncorrectArguments;
    }

    await user.inventory.addItemTemplates(rewardsEntry.items);
    
    const time = Game.nowSec;
    await this._rewardCollection.updateOne({ _id: user.id }, { 
      $set: {
        items: [],
        [`history.${time}`]: rewardsEntry,
        claimed: 0
      } 
    });

    return rewardsEntry.items;
  }

  public async addTestRatings(){
    const users = await Game.db.collection(Collections.Users).aggregate([{$sample:{size:100}}]).toArray();

    const heroClasses = [
      april.HERO_CLASS_KNIGHT,
      april.HERO_CLASS_PALADIN,
      april.HERO_CLASS_ROGUE
    ];

    heroClasses.forEach(async heroClass => {
      users.forEach(async user => {
        await this.updateRank(
          user._id,
          heroClass,
          random.intRange(0, 3000)
        )
      });
    });
  };
}
