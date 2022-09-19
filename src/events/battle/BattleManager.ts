import { Collection, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import _ from "lodash";

import Game from "../../game";
import User from "../../user";
import game from "../../game";

export class BattleManager {
  protected _meta: {
    settings: any;
    classes: any;
    abilities: any;
    effects: any;
    units: any;
  };
  protected _userCollection: Collection;
  protected _rankCollection: Collection;
  protected _mode: string = null;

  constructor() {
    this._userCollection = Game.db.collection(Collections.BattleUsers);
    this._rankCollection = Game.db.collection(Collections.BattleRanks);
  }
  
  get autoCombat() {
    return this._mode === "auto";
  }
  
  get eventStartDate() {
    return new Date(this.meta.settings.eventStartDate * 1000 || '2021-04-01 00:00:00');
  }
  
  get eventEndDate() {
    return new Date(this.meta.settings.eventEndDate * 1000 || '2022-04-14 00:00:00');
  }

  get timeLeft() {
    let secondsLeft = this.eventEndDate.getTime()/1000 - Game.nowSec;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    return secondsLeft;
  }

  get rankingRewards() {
    return this.meta.settings.rankingRewards || [];
  }

  get squadRewards() {
    return this.meta.settings.squadRewards || [];
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
    const settings = await Game.db.collection(Collections.BattleSettings).find() || {};
    const classes = await Game.db.collection(Collections.BattleClasses).find() || {};
    const abilities = await Game.db.collection(Collections.BattleAbilities).find() || {};
    const effects = await Game.db.collection(Collections.BattleEffects).find() || {};
    const units = await Game.db.collection(Collections.BattleUnits).find() || {};

    this._meta = {
      settings,
      classes,
      abilities,
      effects,
      units
    };
  }

  public getAbilityMeta(abilityClass: string) {
    return this.meta.abilities.find(entry => entry.name === abilityClass);
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
    return this._userCollection.findOne({ _id: userId })
  }

  async saveProgress(userId: ObjectId, saveData: any) {
    return this._userCollection.updateOne({ _id: userId }, { $set: saveData }, { upsert: true });
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
