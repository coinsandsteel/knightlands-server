import _ from "lodash";
import moment from 'moment';
import { Collection, Document } from "mongodb";
import { ObjectId } from "bson";
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
const RANKING_WATCHER_PERIOD_MILSECONDS = 15 * 1000;

export class BattleManager {
  protected _debugPersonalEmail: string;
  protected _debug: boolean = true;
  protected _resetPeriod: string;

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

    this._resetPeriod = this.debug ? "minute" : "week";
    this._debugPersonalEmail = this.debug ? "uniwertz@gmail.com" : "";
  }

  get eventStartDate(): number {
    return moment.utc(
      this._meta.settings.eventStartDate ? this._meta.settings.eventStartDate : "2022-10-20 00:00:00"
    ).unix();
  }

  get eventEndDate(): number {
    return moment.utc(
      this._meta.settings.eventEndDate ? this._meta.settings.eventEndDate : "2022-11-21 00:00:00"
    ).unix();
  }

  get timeLeft() {
    let secondsLeft = this.eventEndDate - Game.nowSec;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    return secondsLeft;
  }

  get resetTimeLeft() {
    let secondsLeft = this.nextResetDate - Game.nowSec;
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

  // This friday
  get currentResetDate() {
    if (this._resetPeriod === "week") {
      return moment().utc().day(1).second(0).minute(0).hour(0).unix();
    } else if (this._resetPeriod === "minute") {
      return moment().utc().second(0).unix();
    }
  }

  // Next friday
  get nextResetDate() {
    if (this._resetPeriod === "week") {
      return moment().utc().day(8).second(0).minute(0).hour(0).unix();
    } else if (this._resetPeriod === "minute") {
      return moment().utc().second(0).add(1, 'minutes').unix();
    }
  }

  get meta() {
    return this._meta;
  }

  get debug() {
    return !isProd && this._debug;
  }

  async init() {
    const values = await Promise.all([
      Game.db.collection(Collections.BattleClasses).find().toArray(),
      Game.db.collection(Collections.BattleUnits).find().toArray(),
      Game.db.collection(Collections.BattleAbilities).find().toArray(),
      Game.db.collection(Collections.BattleEffects).find().toArray(),
      Game.db.collection(Collections.BattleSettings).find().toArray(),
      Game.db.collection(Collections.Meta).findOne({ _id: "battle_meta" })
    ]);

    this._meta = {
      classes: _.keyBy(values[0] || [], "_id"),
      units: _.keyBy(values[1] || [], (entry) => parseInt(entry._id)),
      abilities: _.keyBy(values[2] || [], "_id"),
      effects: _.keyBy(values[3] || [], (entry) => parseInt(entry._id)),
      settings: values[4] || [],
    };

    if (this.debug) {
      this.testMeta();
      await this.resetTestRatings();
    }

    // Retrieve lastReset from meta. Once.
    // Since this moment we'll be updating memory variable only.
    this._lastRankingsReset = this.currentResetDate;

    if (this.debug) {
      console.log(`[BattleManager] Initial last reset`, { _lastRankingsReset: this._lastRankingsReset });
    }

    await this.watchResetRankings();
  }

  protected async resetTestRatings() {
    if (!this.debug) {
      return;
    }
    await this._rankCollection.deleteMany({});
    await this.addTestRatings();
    console.log('[BattleManager] Test rating were reset');
  }

  public eventFinished() {
    const now = moment().utc().unix();
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
    setInterval(async () => {
      console.log('[BattleManager] Watcher START');
      await this.commitResetRankings();
      await this.restoreRewards();
      console.log('[BattleManager] Watcher END');
      console.log("");
    }, RANKING_WATCHER_PERIOD_MILSECONDS);
  }

  async commitResetRankings() {
    const resetDate = this.currentResetDate;
    // Last rankings reset was after monday? Skip then.
    if (resetDate <= this._lastRankingsReset) {
      if (this.debug) {
        console.log(
          `[BattleManager] Rankings reset ABORT. _lastRankingsReset(${this._lastRankingsReset}) >= resetDate(${resetDate})`
          );
      }
      return;
    }

    if (this.debug) {
      console.log(
        `[BattleManager] Rankings reset START. _lastRankingsReset(${this._lastRankingsReset}) < resetDate(${resetDate})`
      );
    }

    // Distribute rewards for winners
    await this.distributeRewards();

    // Reset ratings table
    await Game.dbClient.withTransaction(async (db) => {
      await db.collection(Collections.BattleRanks).deleteMany({});
      await db
        .collection(Collections.Meta)
        .updateOne(
          { _id: "battle_meta" },
          { $set: { lastReset: resetDate } },
          { upsert: true }
        );
    });

    // Update reset time.
    // Meta was updated already. It's nothing to do with meta.
    this._lastRankingsReset = resetDate;

    if (this.debug) {
      await this.resetTestRatings();
      console.log(`[BattleManager] Rankings reset END`, {
        _lastRankingsReset: this._lastRankingsReset,
      });
    }
  }

  async distributeRewards() {
    if (this.debug) {
      console.log(`[BattleManager] Rankings distribution START.`);
    }

    const rankSections = {};
    const modes = ["pvp", "power"];

    // Gather ranking tables by mode
    for await (const mode of modes) {
      rankSections[mode] = await this.getRankingsByMode(mode);
    }

    // Save winners list (final reward entry)
    const finalRewardsEntry = await this._finalRankCollection.insertOne({
      date: Game.nowSec,
      ranks: rankSections,
      distributed: false
    });

    if (this.debug) {
      // console.log(`[BattleManager] Winners`, rankSections);
    }

    // Bounce if no final reward entry created
    if (!finalRewardsEntry.insertedId) {
      return;
    }

    // Debit reward by place for every winner
    for await (const mode of modes) {
      await this.debitRewardsByMode(rankSections[mode], mode);
    }

    // Mark final reward entry successfully distributed
    await this._finalRankCollection.updateOne(
      { _id: new ObjectId(finalRewardsEntry.insertedId.toHexString()) },
      { $set: { distributed: true } },
      { upsert: false }
    );

    if (this.debug) {
      console.log(`[BattleManager] Rankings distribution END.`);
    }
  }

  async debitRewardsByMode(rankingTable: any, mode: string, force?: boolean) {
    let rankIndex = 0;
    for await (const rankingEntry of rankingTable) {
      if (+rankingEntry.score == 0) {
        continue;
      }
      await this.debitUserReward(rankingEntry.id, mode, rankIndex + 1, force);
      rankIndex++;
    }
  }

  async restoreRewards() {
    if (this.debug) {
      console.log(
        '[BattleManager] Rewards restoration START'
      );
    }

    // [Prod] Set distributed _id 6366f906955106e8a87b077e
    const updated = await this._finalRankCollection.updateOne(
      { _id: new ObjectId('6366f906955106e8a87b077e') },
      { $set: { distributed: true } },
      { upsert: false }
    );

    // Retrieve all final reward entities
    const undestribituedFinalRewards = await this._finalRankCollection.find({
      distributed: { $not: { $eq: true } }
    }).toArray();

    if (!undestribituedFinalRewards || !undestribituedFinalRewards.length) {
      if (this.debug) {
        console.log(
          '[BattleManager] Rewards restoration END (no undestributed entries)'
        );
      }
      return;
    }

    if (this.debug) {
      console.log(
        '[BattleManager] Undestributed entries found!',
        { undestribituedFinalRewards }
      );
    }

    // Loop through final entry
    for await (let finalEntry of undestribituedFinalRewards) {
      //  Continue if distributed
      if (finalEntry.distributed) {
        continue;
      }

      // Debit reward for user (ignore previuos rewards in rewardCollection)
      const modes = ["pvp", "power"];
      for await (const mode of modes) {
        await this.debitRewardsByMode(finalEntry.ranks[mode], mode, true);
      }

      // Mark as distributed
      const entryId = finalEntry._id.toHexString();
      await this._finalRankCollection.updateOne(
        { _id: new ObjectId(entryId) },
        { $set: { distributed: true } },
        { upsert: false }
      );

      if (this.debug) {
        console.log(
          `[BattleManager] Entry ${entryId} restored, rewards distributed`
        );
      }
    }

    if (this.debug) {
      console.log(
        '[BattleManager] Rewards restoration END'
      );
    }
  }

  async debitUserReward(userId: ObjectId, mode: string, rank: number, force?: boolean) {
    if (this.debug) {
      console.log(`[BattleManager] Debit user reward`, {
        userId,
        mode,
        rank
      });
    }

    let rewardsEntry =
      (await this._rewardCollection.findOne({ _id: userId })) || {};
    let items = rewardsEntry.items || [];
    if (force) {
      items = [];
    }

    let rewardIndex = null;
    if (rank >= 1 && rank <= 4) {
      rewardIndex = rank - 1;
    } else if (rank >= 5 && rank <= 10) {
      rewardIndex = 4;
    } else {
      return;
    }

    const rewardItems = this.rankingRewards[rewardIndex].items;

    if (this.debug) {
      /*console.log(`[BattleManager] Rewards BEFORE debit`, {
        userId,
        mode,
        rank,
        items,
      });*/
    }

    rewardItems.forEach((itemEntry) => {
      let receivedItemIndex = items.findIndex(
        (receivedItem) => receivedItem.item === itemEntry.item
      );
      if (receivedItemIndex === -1) {
        items.push(_.cloneDeep(itemEntry));
      } else {
        items[receivedItemIndex].quantity += itemEntry.quantity;
        if (this.debug) {
          /*console.log(`[BattleManager] Quantity increased`, {
            userId,
            mode,
            rank,
            ...itemEntry,
          });*/
        }
      }
    });

    if (this.debug) {
      /*console.log(`[BattleManager] Rewards AFTER debit`, {
        userId,
        mode,
        rank,
        items,
      });
      console.log("");*/
    }

    await this._rewardCollection.updateOne(
      { _id: userId },
      { $set: { items, [`ranks.${mode}`]: rank, claimed: false } },
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

  public async getUserRankData(userId: ObjectId): Promise<Document> {
    return await this._rankCollection.findOne({ _id: userId });
  }

  public async getRankingsByMode(mode: string) {
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
        .findOne({ address: this._debugPersonalEmail });

      if (me) {
        await this.updateRank(me._id, mode, 2985);
      }

      for await (const user of users) {
        await this.updateRank(user._id, mode, _.random(0, 3000));
      }
    }

    if (this.debug) {
      console.log(`[BattleManager] Test ratings were created`);
    }
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

  // Test meta
  public testMeta() {
    for (const unitId in this._meta.units) {
      this.loadUnitMeta(parseInt(unitId));
    }
    for (const abilityClass in this._meta.abilities) {
      this.loadAbilityMeta(abilityClass);
    }
  }
}
