import { ObjectId } from "mongodb";

import game from "../../../game";
import events from "../../../knightlands-shared/events";
import { BattleService } from "./BattleService";
import { BattleRewardDayData, BattleSquadState, BattleTerrainMap, BattleBuff, BattleInitiativeRatingEntry, BattleUnitAbility, BattleAdventuresState, BattleCombatRewards, BattleRewardSquadData, BattleUnit, BattleFighter } from "../types";
import { Unit } from "../units/Unit";
import { Fighter } from "../units/Fighter";

export class BattleEvents extends BattleService {
  protected _events: any;
  protected _userId: ObjectId;

  constructor(userId: ObjectId) {
    super();
    this._userId = userId;
    this._events = {};
  }

  flush() {
    //this.log("Event flush", this._events);
    game.emitPlayerEvent(this._userId, events.BattleUpdate, this._events);
    this._events = {};
  }

  updateUnit(unit: BattleUnit) {
    if (this._events.updateUnit === undefined) {
      this._events.updateUnit = {};
    }
    this._events.updateUnit[unit.unitId] = unit;
  }

  addUnit(unit: BattleUnit) {
    this._events.addUnit = this._events.addUnit || [];
    this._events.addUnit.push(unit);
  }

  removeUnit(unit: Unit) {
    this._events.removeUnit = unit.template;
  }

  inventory(units: BattleUnit[]) {
    this._events.inventory = units;
  }

  balance(balance) {
    this._events.balance = balance;
  }

  pvpScore(value) {
    this._events.pvpScore = value;
  }

  counters(counters) {
    this._events.counters = counters;
  }

  items(items) {
    this._events.items = items;
  }

  dailyRewards(rewards: BattleRewardDayData[]) {
    this._events.dailyRewards = rewards;
  }

  squadRewards(rewards: BattleRewardSquadData[]) {
    this._events.squadRewards = rewards;
  }

  combatRewards(rewards: BattleCombatRewards) {
    this._events.combatRewards = rewards;
  }

  mode(mode: string) {
    this._events.mode = mode;
  }

  location(location: number) {
    this._events.location = location;
  }

  level(level: number) {
    this._events.level = level;
  }

  difficulty(difficulty: string) {
    this._events.difficulty = difficulty;
  }

  adventures(adventures: BattleAdventuresState) {
    this._events.adventures = adventures;
  }

  userSquad(squad: BattleSquadState) {
    this._events.userSquad = squad;
  }

  enemySquad(squad: BattleSquadState) {
    this._events.enemySquad = squad;
  }

  initiativeRating(initiativeRating: BattleInitiativeRatingEntry[]) {
    this._events.initiativeRating = initiativeRating;
  }

  buffs(fighterId: string, buffs: BattleBuff[]) {
    if (this._events.buffs === undefined) {
      this._events.buffs = {};
    }
    this._events.buffs[fighterId] = buffs;
  }

  abilities(fighterId: string, abilities: BattleUnitAbility[]) {
    if (this._events.abilities === undefined) {
      this._events.abilities = {};
    }
    this._events.abilities[fighterId] = abilities;
  }

  userFighter(fighter: BattleFighter) {
    if (this._events.userFighter === undefined) {
      this._events.userFighter = [];
    }
    this._events.userFighter.push(fighter);
  }

  enemyFighter(fighter: BattleFighter) {
    if (this._events.enemyFighter === undefined) {
      this._events.enemyFighter = [];
    }
    this._events.enemyFighter.push(fighter);
  }

  terrain(terrain: BattleTerrainMap) {
    this._events.terrain = terrain;
  }

  combatStarted(value: boolean) {
    this._events.combatStarted = value;
  }

  activeFighterId(value: string) {
    this._events.activeFighterId = value;
  }

  combatResult(value: string|null) {
    this._events.combatResult = value;
  }

  combatMoveCells(value: number[]) {
    this._events.combatMoveCells = value;
  }

  combatAttackCells(value: number[]) {
    this._events.combatAttackCells = value;
  }

  combatTargetCells(value: number[]) {
    this._events.combatTargetCells = value;
  }

  effect(payload) {
    this._events.effects = this._events.effects || [];
    this._events.effects.push(payload);
  }
}
