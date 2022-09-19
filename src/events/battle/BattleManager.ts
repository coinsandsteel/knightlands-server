import { Collection, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import _ from "lodash";

import Game from "../../game";
import User from "../../user";
import {
  BattleAbilityMeta,
  BattleMeta,
  BattleEffectMeta,
  BattleUnitMeta,
} from "./units/db_meta";

export class BattleManager {
  protected _meta: BattleMeta;
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
    return new Date(
      this._meta.settings.eventStartDate * 1000 || "2021-04-01 00:00:00"
    );
  }

  get eventEndDate() {
    return new Date(
      this._meta.settings.eventEndDate * 1000 || "2022-04-14 00:00:00"
    );
  }

  get timeLeft() {
    let secondsLeft = this.eventEndDate.getTime() / 1000 - Game.nowSec;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    return secondsLeft;
  }

  get rankingRewards() {
    return this._meta.settings.rankingRewards || [];
  }

  get squadRewards() {
    return this._meta.settings.squadRewards || [];
  }

  get midnight() {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return midnight.getTime();
  }

  get meta() {
    return this._meta;
  }

  async init() {
    const values = await Promise.all([
      Game.db.collection(Collections.BattleClasses).find(),
      Game.db.collection(Collections.BattleUnits).find(),
      Game.db.collection(Collections.BattleAbilities).find(),
      Game.db.collection(Collections.BattleEffects).find()
    ]);

    this._meta = {
      settings: {},
      classes: values[0] || {},
      units: values[1] || {},
      abilities: values[2] || {},
      effects: values[3] || {},
    }

    this.testMeta();
  }

  public getEffectMeta(effectId: number): BattleEffectMeta|null {
    return _.cloneDeep(this._meta.effects[effectId]) || null;
  }

  public getAbilityMeta(abilityClass: string, unitId?: number): BattleAbilityMeta | null {
    const abilityMeta = _.cloneDeep(this._meta.abilities[abilityClass]);
    if (!abilityMeta) {
      return null;
    }
    const effects = abilityMeta.effects.map((levelData) =>
      levelData.map((drawData) =>
        drawData.map((effectId: number) => {
          const effectMeta = this.getEffectMeta(effectId);
          if (!effectMeta) {
            throw new Error(`[Battle meta] Missing effect meta #${effectId} (unit #${unitId}, ability #${abilityId})`);
          }
          return this.getEffectMeta(effectId);
        })
      )
    );
    abilityMeta.effects = effects;
    return abilityMeta;
  }

  public getUnitMeta(unitId: number): BattleUnitMeta {
    const unitMeta = _.cloneDeep(this._meta.units[unitId]);
    if (!unitMeta) {
      throw Error(`[Battle meta] Unit meta #${unitId} is not found`);
    }
    unitMeta.abilities = unitMeta.abilities.map((abilityClass: string) => {
      const abilityMeta = this.getAbilityMeta(abilityClass, unitId);
      if (!abilityMeta) {
        throw new Error(`[Battle meta] Missing ability meta #${abilityClass} (unit #${unitId})`);
      }
    });
    return unitMeta;
  }

  public testMeta() {
    for (const unitId in this._meta.units) {
      this.getUnitMeta(this._meta.units[unitId]._id);
    }
    console.log('[Battle meta] Meta is valid');
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
    return this._saveCollection.findOne({ _id: userId });
  }

  async saveProgress(userId: ObjectId, saveData: any) {
    return this._saveCollection.updateOne(
      { _id: userId },
      { $set: saveData },
      { upsert: true }
    );
  }

  async getRankings() {
    const result = [];
    return result;
  }

  public async userHasRewards(user: User) {}

  public async claimRankingRewards(user: User) {}

  public async addTestRatings() {}

  public resetMode() {
    this._mode = null;
  }

  public enableAutoCombat() {
    this._mode = "auto";
  }
}
