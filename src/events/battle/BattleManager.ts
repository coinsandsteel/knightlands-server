import { Collection, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import _ from "lodash";

import Game from "../../game";
import User from "../../user";

export class BattleManager {
  protected _meta: any;
  protected _saveCollection: Collection;
  protected _rankCollection: Collection;
  protected _mode: string = null;

  constructor() {
    this._saveCollection = Game.db.collection(Collections.BattleUsers);
    this._rankCollection = Game.db.collection(Collections.BattleRanks);
  }
  
  get autoCombat() {
    return this._mode === "auto";
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

  get rankingRewards() {
    return this._meta.rankingRewards || [];
  }

  get squadRewards() {
    return this._meta.squadRewards || [];
  }

  get midnight() {
    const midnight = new Date();
    midnight.setHours(0,0,0,0);
    return midnight.getTime();
  }

  get meta() {
    return this._meta;
  }

  async init() {
    this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "battle_meta" }) || {};

    // TODO create indexes
    //this._rankCollection.createIndex({ maxSessionGold: 1 });
    //this._rankCollection.createIndex({ order: 1 });
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

  async getRankings() {
    const result = [];
    return result;
  }

  public async userHasRewards(user: User) {
  }

  public async claimRankingRewards(user: User) {
  }

  public async addTestRatings(){
  };

  public resetMode() {
    this._mode = null;
  }

  public enableAutoCombat() {
    this._mode = "auto";
  }
}
