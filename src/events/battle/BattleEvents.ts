import { ObjectId } from "mongodb";

import game from "../../game";
import events from "../../knightlands-shared/events";
import { BattleRewardDayData, BattleRewardRankingData, BattleSquadState, BattleSquadUnitUpdate, BattleTerrainCell } from "./types";
import { Unit } from "./units/Unit";

export class BattleEvents {
  private _events: any;
  private _userId: ObjectId;

  constructor(userId: ObjectId) {
      this._userId = userId;
      this._events = {};
  }

  flush() {
    game.emitPlayerEvent(this._userId, events.BattleUpdate, this._events);
    this._events = {};
  }

  updateUnit(unit: Unit) {
    this._events.updateUnit = unit.serialize();
  }

  addUnit(unit: Unit) {
    this._events.addUnit = unit.serialize();
  }

  inventory(units: Unit[]) {
    this._events.inventory = units.map((unit: Unit) => unit.serialize());
  }

  balance(balance) {
    this._events.balance = balance;
  }

  timers(timers) {
    this._events.timers = timers;
  }

  dailyRewards(rewards: BattleRewardDayData[]) {
    this._events.dailyRewards = rewards;
  }

  rankingRewards(rewards: BattleRewardRankingData) {
    this._events.rankingRewards = rewards;
  }

  mode(mode: string) {
    this._events.mode = mode;
  }

  room(room: number) {
    this._events.room = room;
  }

  level(level: number) {
    this._events.level = level;
  }

  difficulty(difficulty: string) {
    this._events.difficulty = difficulty;
  }

  adventureDifficulty(difficulty: string) {
    this._events.adventureDifficulty = difficulty;
  }

  userSquad(squad: BattleSquadState) {
    this._events.userSquad = squad;
  }

  enemySquad(squad: BattleSquadState) {
    this._events.enemySquad = squad;
  }

  userSquadUnit(data: BattleSquadUnitUpdate) {
    if (this._events.userSquadUnit === undefined) {
      this._events.userSquadUnit = [];
    }
    this._events.userSquadUnit.push(data);
  }

  enemySquadUnit(data: BattleSquadUnitUpdate) {
    if (this._events.enemySquadUnit === undefined) {
      this._events.enemySquadUnit = [];
    }
    this._events.enemySquadUnit.push(data);
  }

  terrain(terrain: BattleTerrainCell[]) {
    this._events.terrain = terrain;
  }

  combatStarted(value: boolean) {
    this._events.combatStarted = value;
  }

  combatResult(value: string) {
    this._events.combatResult = value;
  }

  combatMoveCells(value: number[]) {
    this._events.combatMoveCells = value;
  }

  combatAttackCells(value: number[]) {
    this._events.combatAttackCells = value;
  }

  effect(data) {
    this._events.effect = data;
  }
}
