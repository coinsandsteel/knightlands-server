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
  BattleClassMeta,
} from "./units/MetaDB";
import * as battle from "../../knightlands-shared/battle";

export class BattleManager {
  protected _meta: BattleMeta;
  protected _saveCollection: Collection;
  protected _rankCollection: Collection;
  protected _mode: string = null;
  protected _abilityTypes: { [abilityClass: string]: string };

  constructor() {
    this._saveCollection = Game.db.collection(Collections.BattleUsers);
    this._rankCollection = Game.db.collection(Collections.BattleRanks);
    this._abilityTypes = {};
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
      Game.db.collection(Collections.BattleClasses).find().toArray(),
      Game.db.collection(Collections.BattleUnits).find().toArray(),
      Game.db.collection(Collections.BattleAbilities).find().toArray(),
      Game.db.collection(Collections.BattleEffects).find().toArray(),
    ]);

    this._meta = {
      settings: {},
      classes: _.keyBy(values[0] || [], "_id"),
      units: _.keyBy(values[1] || [], (entry) => parseInt(entry._id)),
      abilities: _.keyBy(values[2] || [], "_id"),
      effects: _.keyBy(values[3] || [], (entry) => parseInt(entry._id)),
    };

    this.testMeta();
  }

  // Getters

  public getEffectMeta(effectId: number): BattleEffectMeta | null {
    return _.cloneDeep(this._meta.effects[effectId]) || null;
  }

  public getAbilityMeta(abilityClass: string): BattleAbilityMeta | null {
    return _.cloneDeep(this._meta.abilities[abilityClass]) || null;
  }

  public getUnitMeta(template: number): BattleUnitMeta | null {
    return _.cloneDeep(this._meta.units[template]) || null;
  }

  public getClassMeta(unitClass: string): BattleClassMeta | null {
    return _.cloneDeep(this._meta.classes[unitClass]) || null;
  }

  public getAbilityType(abilityMeta: BattleAbilityMeta): string {
    if (this._abilityTypes[abilityMeta.abilityClass]) {
      return this._abilityTypes[abilityMeta.abilityClass];
    }

    const rulesList = {
      [battle.ABILITY_TYPE_BUFF]: {
        canMove: false,
        affectHp: false,
        targetAllies: true,
        targetSelf: true,
        targetEnemies: false,
        targetEmptyCell: false,
        hasEffects: true,
      },
      [battle.ABILITY_TYPE_SELF_BUFF]: {
        canMove: false,
        affectHp: false,
        targetAllies: false,
        targetSelf: true,
        targetEnemies: false,
        targetEmptyCell: false,
        hasEffects: true,
      },
      [battle.ABILITY_TYPE_DE_BUFF]: {
        affectHp: false,
        targetAllies: false,
        targetSelf: false,
        targetEnemies: true,
        targetEmptyCell: false,
        hasEffects: true,
      },
      [battle.ABILITY_TYPE_JUMP]: {
        canMove: true,
        affectHp: false,
        targetAllies: false,
        targetSelf: false,
        targetEnemies: false,
        targetEmptyCell: true,
        hasEffects: false,
      },
      [battle.ABILITY_TYPE_HEALING]: {
        canMove: false,
        affectHp: true,
        targetAllies: true,
        targetSelf: true,
        targetEnemies: false,
        targetEmptyCell: false
      },
      [battle.ABILITY_TYPE_ATTACK]: {
        affectHp: true,
        targetAllies: false,
        targetSelf: false,
        targetEnemies: true,
        targetEmptyCell: false
      },
    };

    for (let abilityType in rulesList) {
      const abilityRules = rulesList[abilityType];
      const shouldHaveEffects = _.clone(abilityRules.hasEffects);
      delete abilityRules.hasEffects;

      const metaBlueprint = _.pick(abilityMeta, Object.keys(abilityRules));
      const rulesMatched = _.isEqual(metaBlueprint, abilityRules);
      const effectsMatched =
        shouldHaveEffects === undefined ||
        !!abilityMeta.effects[0].length === shouldHaveEffects;

      if (rulesMatched && effectsMatched) {
        this._abilityTypes[abilityMeta.abilityClass] = abilityType;
        return abilityType;
      }
    }

    return "*** unknown ***";
  }

  // Loaders

  public loadAbilityMeta(
    abilityClass: string,
    template?: number
  ): BattleAbilityMeta | null {
    const abilityMeta = _.cloneDeep(this._meta.abilities[abilityClass]);
    if (!abilityMeta) {
      return null;
    }
    const effects = abilityMeta.effects.map((levelData) =>
      levelData.map((drawData) =>
        drawData.map((effectId: number) => {
          const effectMeta = this.getEffectMeta(effectId);
          if (!effectMeta) {
            throw new Error(
              `[Battle meta] Missing effect meta #${effectId} (unit template #${template}, ability #${abilityClass})`
            );
          }
          return this.getEffectMeta(effectId);
        })
      )
    );
    abilityMeta.effects = effects;
    abilityMeta.abilityType = this.getAbilityType(abilityMeta);
    return abilityMeta;
  }

  public loadUnitMeta(template: number): BattleUnitMeta {
    const unitMeta = _.cloneDeep(this._meta.units[template]);
    if (!unitMeta) {
      throw Error(`[Battle meta] Unit meta #${template} is not found`);
    }
    unitMeta.abilities = unitMeta.abilityList.map((abilityClass: string) => {
      const abilityMeta = this.loadAbilityMeta(abilityClass, template);
      if (!abilityMeta) {
        throw new Error(
          `[Battle meta] Missing ability meta #${abilityClass} (unit template #${template})`
        );
      }
    });
    return unitMeta;
  }

  // Test

  public testMeta() {
    for (const unitId in this._meta.units) {
      this.loadUnitMeta(parseInt(unitId));
    }
    for (const abilityClass in this._meta.abilities) {
      const abilityMeta = this.loadAbilityMeta(abilityClass);
      console.log({
        class: abilityMeta.abilityClass,
        type: abilityMeta.abilityType,
      });
    }
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
