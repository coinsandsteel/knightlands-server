import { NumberLiteralType } from "typescript";

export interface BattleSaveData {
  user: BattleUserState;
  game: BattlGameState;
}

export interface BattleUserState {
  balance: {
    energy: number;
    gold: number;
    coins: number;
    crystals: number;
  };
  rewards: {
    dailyRewards: BattleRewardDayData[];
    rankingRewards: BattleRewardRankingData;
  }
}

export interface BattleRewardDayData {
  collected: boolean;
  quantity: number;
  active: boolean;
  date?: string;
}

export interface BattleRewardRankingData {
}

export interface BattlGameState {
  room: number;
  level: number;
  turn: boolean;
  squads: {
    user: BattleSquad;
    enemy: BattleSquad;
  };
  map: BattleMapCell[];
}

export interface BattleSquad {
  power: number;
  bonus: BattleSquadBonus[];
  units: BattleUnit[];
}

export interface BattleUnit {
  unitClass: string;
  index: number;
  power: number;
  tier: number;
  exp: number;
  level: number;
  abilities: BattleUnitAbility[];
  attributes: BattleUnitAttribute[];
  coverageArea: number[];
  // hp:
  // damage:
  // defence:
  // speed: 
  // initiative:
}

export interface BattleMapCell {
  cellClass: string;
}

export interface BattleUnitAbility {
  alias: string;
  level: number;
  initial: number;
  current: number;
  max: number;
  cooldown: number; // turns
}

export interface BattleUnitAttribute {
  alias: string;
  level: number;
  initial: number;
  current: number;
  max: number;
}

export interface BattleSquadBonus {
  alias: string;
  level: number;
  initial: number;
  current: number;
  max: number;
}
