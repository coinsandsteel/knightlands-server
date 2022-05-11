export interface BattleSaveData {
  user: BattleUserState;
  game: BattlGameState;
}

export interface BattleUserState {
  balance: {
    energy: number;
    coins: number; // PvE, upgrade unit level
    crystals: number; // PvP, upgrade ability level
  };
  timers: {
    // TODO research timers
    energy: number;
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
  room: number; // 8
  difficulty: number; // 0, 1
  level: number; // 5 + 1
  turn: boolean;
  squads: {
    user: BattleSquad;
    enemy: BattleSquad;
  };
  terrain: BattleTerrainCell[];
}

export interface BattleSquad {
  power: number;
  bonus: BattleSquadBonus[];
  units: BattleUnit[];
}

export interface BattleUnit {
  id?: string;
  unitClass: string; // 5
  // exp > max limit > pay coins > lvl up > attributes auto-upgrade
  level: number; // 15
  tier: number; // 3, modify via merger (3 => 1)
  power: number;
  index: number; // 0-34
  exp: number;
  abilities: BattleUnitAbility[];
  attributes: BattleUnitAttribute[];
  moveCells: number[]; // Choosed "move" action
  attackCells: number[]; // Choosed ability
}

export interface BattleTerrainCell {
  terrainClass: string; // >= 5
  index: number;
}

export interface BattleUnitAbility {
  abilityClass: string; // 
  // unit lvl opens ability lvl > pay crystal > lvl up
  level: number; // 3-5
  value: {
    initial: number;
    current: number;
  };
  cooldown: {
    initial: number;
    current: number;
  };
  buffs: BattleBuff[];
}

export interface BattleUnitAttribute {
  attributeClass: string;
  level: number;
  initial: number;
  current: number;
}

export interface BattleBuff {
  buffClass: string;
  delta: number;
  modifier: number; // % > ceil()
  cooldown: number;
}

export interface BattleSquadBonus {
  // magic attack
  // phys attack
  // magic defence
  // phys defence
  // terrain
  // speed
  alias: string;
  // TODO details
  value: number; // % or delta
  modifier: number;
}
