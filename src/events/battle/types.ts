export interface BattleSaveData {
  user: BattleUserState;
  game: BattleGameState;
  inventory: BattleInventoryUnit[];
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

export interface BattleInventoryUnit {
  unitId?: string;
  unitTribe: string; // 15
  unitClass: string; // 5
  tier: number; // 3, modify via merger (3 => 1) // exp > max limit > pay coins > lvl up > characteristics auto-upgrade
  level: number; // 15
  power: number;
  expirience: {
    current: number; // gained value (relative)
    max: number; // full value (relative)
  };
  characteristics: BattleUnitCharacteristics;
  abilities: InventoryUnitAbility[];
  quantity: number;
}

export interface BattleRewardRankingData {}

export interface BattleGameState {
  mode: string|null; // "duel" | "adventure"
  room: number|null; // 8
  difficulty: number|null; // 0, 1

  userSquad: BattleSquadState;
  enemySquad: BattleSquadState;

  level: number|null; // 5 + 1
  terrain: BattleTerrainCell[];
  combat: BattleCombatState;
}

export interface BattleCombatState {
  started: boolean;
  result: string|null; // "win" | "loose"
  isMyTurn: boolean|null;
  runtime: {
    unitId: string|null;
    selectedIndex: number|null;
    selectedAbilityClass: string|null;
    moveCells: number[];
    attackCells: number[];
  };
}

export interface BattleSquadState {
  power: number;
  bonuses: BattleSquadBonus[];
  units: BattleSquadUnit[];
}

export interface BattleSquadUnit {
  unitId?: string;
  unitTribe: string; // 15
  unitClass: string; // 5
  tier: number; // 3, modify via merger (3 => 1) // exp > max limit > pay coins > lvl up > characteristics auto-upgrade
  index: number; // 0-34
  hp: number;
  abilities: BattleUnitAbility[];
  activeBuffs: BattleBuff[];
}

export interface BattleUnitCharacteristics {
  hp: number;
  damage: number;
  defence: number;
  initiative: number;
  speed: number;
}

export interface BattleTerrainCell {
  terrainClass: string; // >= 5
  index: number;
}

export interface InventoryUnitAbility {
  abilityClass: string; // 
  canLearn: boolean; // unit lvl opens ability lvl > pay crystal > lvl up
  level: number; // 3-5
}

export interface BattleUnitAbility {
  abilityClass: string;
  cooldown: {
    enabled: boolean;
    stepsLeft: number;
    stepsMax: number;
  }
}

export interface BattleUnitAttribute {
  attributeClass: string;
  level: number;
  initial: number;
  current: number;
}

export interface BattleBuff {
  buffClass: string;
  type: string;
  target: string;
}

export interface BattleSquadBonus {
  alias: string;
  value: number; // % or delta
  modifier: number;
}
