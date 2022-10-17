import _ from "lodash";
import { Collection, ObjectId } from "mongodb";
import { Collections } from "../../database/database";

import Game from "../../game";
import * as battle from "../../knightlands-shared/battle";
import errors from "../../knightlands-shared/errors";
import User from "../../user";
import {
  BattleAbilityMeta,
  BattleClassMeta,
  BattleEffectMeta,
  BattleMeta,
  BattleUnitMeta,
} from "./units/MetaDB";

const isProd = process.env.ENV == "prod";
const RANKING_WATCHER_PERIOD_MILSECONDS = 1 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export class BattleManager {
  protected _meta: BattleMeta;
  protected _abilityTypes: { [abilityClass: string]: string };

  protected _saveCollection: Collection;
  protected _rankCollection: Collection;
  protected _finalRankCollection: Collection;
  protected _rewardCollection: Collection;

  protected _lastRankingsReset: number;

  constructor() {
    this._saveCollection = Game.db.collection(Collections.BattleUsers);
    this._rankCollection = Game.db.collection(Collections.BattleRanks);
    this._rewardCollection = Game.db.collection(Collections.BattleRewards);
    this._finalRankCollection = Game.db.collection(
      Collections.BattleFinalRanks
    );
    this._abilityTypes = {};
  }

  get eventStartDate() {
    return new Date(
      this._meta.settings.eventStartDate * 1000 || "2021-10-05 00:00:00"
    );
  }

  get eventEndDate() {
    return new Date(
      this._meta.settings.eventEndDate * 1000 || "2022-11-05 00:00:00"
    );
  }

  get timeLeft() {
    let secondsLeft = this.eventEndDate.getTime() / 1000 - Game.nowSec;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    return secondsLeft;
  }

  get resetTimeLeft() {
    let secondsLeft = this.nextMidnight / 1000 - Game.nowSec;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    return secondsLeft;
  }

  get rankingRewards() {
    return this._meta.settings.rankingRewards || battle.RANKING_REWARDS;
  }

  get squadRewards() {
    return this._meta.settings.squadRewards || [];
  }

  get midnight() {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return midnight.getTime();
  }

  get nextMidnight() {
    const midnight = new Date();
    midnight.setHours(23, 59, 59, 0);
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
      Game.db.collection(Collections.BattleSettings).find().toArray(),
    ]);

    this._meta = {
      classes: _.keyBy(values[0] || [], "_id"),
      units: _.keyBy(values[1] || [], (entry) => parseInt(entry._id)),
      abilities: _.keyBy(values[2] || [], "_id"),
      effects: _.keyBy(values[3] || [], (entry) => parseInt(entry._id)),
      settings: values[4] || [],
    };

    // this.testMeta();

    if (!isProd) {
      await this._rankCollection.deleteMany({});
      await this.addTestRatings();
      await this.distributeRewards();
    }

    // Retrieve lastReset from meta. Once.
    // Since this moment we'll be updating memory variable only.
    this._lastRankingsReset = this._meta.settings.lastReset || this.midnight;
    //console.log(`[BattleManager] Initial last reset`, { _lastRankingsReset: this._lastRankingsReset });

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
    return this._saveCollection.findOne({ _id: userId });
  }

  async saveProgress(userId: ObjectId, saveData: any) {
    return this._saveCollection.updateOne(
      { _id: userId },
      { $set: saveData },
      { upsert: true }
    );
  }

  async watchResetRankings() {
    if (!isProd) {
      await this._rankCollection.deleteMany({});
      await this.addTestRatings();
      await this.distributeRewards();
    } else {
      setInterval(async () => {
        await this.commitResetRankings();
      }, RANKING_WATCHER_PERIOD_MILSECONDS);
    }
  }

  protected relativeDayStart(day: number) {
    return this.eventStartDate.getTime() + DAY * (day - 1);
  }

  async commitResetRankings() {
    const midnight = this.midnight;
    // Last reset was in midnight or earlier? Skip reset then.
    if (this._lastRankingsReset >= midnight) {
      console.log(
        `[BattleManager] Rankings reset ABORT. _lastRankingsReset(${this._lastRankingsReset}) >= midnight(${midnight})`
      );
      return;
    }

    console.log(
      `[BattleManager] Rankings reset LAUNCH. _lastRankingsReset(${this._lastRankingsReset}) < midnight(${midnight})`
    );

    // Distribute rewards for winners
    await this.distributeRewards();

    // Last reset was more that day ago? Launch reset.
    await Game.dbClient.withTransaction(async (db) => {
      await db.collection(Collections.BattleRanks).deleteMany({});
      await db
        .collection(Collections.Meta)
        .updateOne(
          { _id: "battle_meta" },
          { $set: { lastReset: midnight } },
          { upsert: true }
        );
    });

    // Update reset time.
    // Meta was updated already. It's nothing to do with meta.
    this._lastRankingsReset = midnight;
    console.log(`[BattleManager] Rankings reset FINISH.`, {
      _lastRankingsReset: this._lastRankingsReset,
    });
  }

  async distributeRewards() {
    console.log(`[BattleManager] Rankings distribution LAUNCHED.`);

    const dateRanks = {};
    const modes = ["pvp", "power"];
    for await (const mode of modes) {
      const modeRankings = await this.getRankingsByMode(mode);
      let rankIndex = 0;
      for await (const rankingEntry of modeRankings) {
        if (+rankingEntry.score == 0) {
          continue;
        }
        await this.debitUserReward(rankingEntry.id, mode, rankIndex + 1);
        rankIndex++;
      }
      dateRanks[mode] = modeRankings;
    }

    await this._finalRankCollection.insertOne({
      date: Game.nowSec,
      ranks: dateRanks,
    });

    console.log(`[BattleManager] Rankings distribution FINISHED.`);
  }

  async debitUserReward(userId: ObjectId, mode: string, rank: number) {
    let rewardsEntry =
      (await this._rewardCollection.findOne({ _id: userId })) || {};
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

    if (!isProd) {
      console.log(`[BattleManager] Rewards BEFORE debit`, {
        userId,
        mode,
        rank,
        items,
      });
    }
    rewardItems.forEach((itemEntry) => {
      let receivedItemIndex = items.findIndex(
        (receivedItem) => receivedItem.item === itemEntry.item
      );
      if (receivedItemIndex === -1) {
        items.push(_.cloneDeep(itemEntry));
      } else {
        items[receivedItemIndex].quantity += itemEntry.quantity;
        if (!isProd) {
          console.log(`[BattleManager] Quantity increased`, {
            userId,
            mode,
            rank,
            ...itemEntry,
          });
        }
      }
    });
    if (!isProd) {
      console.log(`[BattleManager] Rewards AFTER debit`, {
        userId,
        mode,
        rank,
        items,
      });
      console.log("");
    }

    await this._rewardCollection.updateOne(
      { _id: userId },
      { $set: { items, [`ranks.${mode}`]: rank } },
      { upsert: true }
    );
  }

  async updateRank(
    userId: ObjectId,
    mode: string,
    points: number
  ): Promise<any> {
    if (this.eventFinished()) {
      return;
    }

    let request = {};

    if (mode === "pvp") {
      request = {
        $setOnInsert: { power: 0 },
        $set: { order: Game.now },
        $inc: { pvp: points },
      };
    } else if (mode === "power") {
      request = {
        $setOnInsert: { pvp: 0 },
        $set: { order: Game.now, power: points },
      };
    } else {
      return;
    }

    await this._rankCollection.updateOne({ _id: userId }, request, {
      upsert: true,
    });
  }

  async getRankingsByMode(mode: string) {
    const records = await this._rankCollection
      .aggregate([
        { $sort: { [mode]: -1, order: 1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $project: {
            id: "$_id",
            name: {
              $ifNull: [{ $arrayElemAt: ["$user.character.name.v", 0] }, ""],
            },
            avatar: {
              $ifNull: [{ $arrayElemAt: ["$user.character.avatar", 0] }, -1],
            },
            score: "$" + mode,
          },
        },
        {
          $project: { _id: 0 },
        },
      ])
      .toArray();

    return records;
  }

  public async userHasRewards(user: User) {
    const rewardsEntry = await this._rewardCollection.findOne({ _id: user.id });
    return (
      rewardsEntry &&
      rewardsEntry.items &&
      rewardsEntry.items.length &&
      !rewardsEntry.claimed
    );
  }

  public async claimRankingRewards(user: User) {
    const rewardsEntry = await this._rewardCollection.findOne({ _id: user.id });
    if (!rewardsEntry || !rewardsEntry.items.length || rewardsEntry.claimed) {
      throw errors.IncorrectArguments;
    }

    await user.inventory.addItemTemplates(rewardsEntry.items);

    delete rewardsEntry.history;
    const time = Game.nowSec;
    await this._rewardCollection.updateOne(
      { _id: user.id },
      {
        $set: {
          items: [],
          ranks: {},
          [`history.${time}`]: rewardsEntry,
          claimed: true,
          time,
        },
      }
    );

    return rewardsEntry.items;
  }

  public async addTestRatings() {
    const users = await Game.db
      .collection(Collections.Users)
      .aggregate([
        {
          $sample: { size: 100 },
        },
      ])
      .toArray();

    // For tests: email
    for await (const mode of ["pvp", "power"]) {
      const me = await Game.db
        .collection(Collections.Users)
        .findOne({ address: "uniwertz@gmail.com" });

      if (me) {
        await this.updateRank(me._id, mode, 2985);
      }

      for await (const user of users) {
        await this.updateRank(user._id, mode, _.random(0, 3000));
      }
    }

    console.log(`[BattleManager] Test ratings were created`);
  }

  // #######################################################################
  // Meta
  // #######################################################################

  public getEffectMeta(effectId: number): BattleEffectMeta | null {
    return _.cloneDeep(this._meta.effects[effectId]) || null;
  }

  public getAbilityMeta(abilityClass: string): BattleAbilityMeta | null {
    return _.cloneDeep(this._meta.abilities[abilityClass]) || null;
  }

  public getUnitMeta(template: number): BattleUnitMeta | null {
    return _.cloneDeep(this._meta.units[template]) || null;
  }

  public getUnitMetaByParams(params: {
    class: string;
    tribe: string;
    tier: number;
  }): BattleUnitMeta | null {
    return _.cloneDeep(_.find(Object.values(this._meta.units), params)) || null;
  }

  public getAllUnitsMetaByParams(params: {
    class?: string;
    tribe?: string;
    tier?: number;
  }): BattleUnitMeta[] | null {
    return _.cloneDeep(_.filter(Object.values(this._meta.units), params)) || null;
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
        targetEmptyCell: false,
      },
      [battle.ABILITY_TYPE_ATTACK]: {
        affectHp: true,
        targetAllies: false,
        targetSelf: false,
        targetEnemies: true,
        targetEmptyCell: false,
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

  // #######################################################################
  // Loaders
  // #######################################################################

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
      this.loadAbilityMeta(abilityClass);
      /*console.log({
        class: abilityMeta.abilityClass,
        type: abilityMeta.abilityType,
      });*/
    }
  }
}
