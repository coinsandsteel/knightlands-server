export interface BattleSaveData {
  user: BattleUserState;
  game: BattleGameState;
  inventory: BattleUnit[];
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
  },
  adventures: object;
  /*
  adventures: {
    1: {
      1: { [GAME_DIFFICULTY_MEDIUM]: true, [GAME_DIFFICULTY_HIGH]: false },
      //2: { [GAME_DIFFICULTY_MEDIUM]: false, [GAME_DIFFICULTY_HIGH]: false },
    }
  }
  */
}

export interface BattleRewardDayData {
  collected: boolean;
  quantity: number;
  active: boolean;
  date?: string;
}

export interface BattleUnit {
  template: number;
  unitTribe: string; // 15
  unitClass: string; // 5
  unitId?: string;
  fighterId?: string;
  tier?: number; // 3, modify via merger (3 => 1)
  levelInt?: number;
  level?: BattleLevelScheme;  // exp > max limit > pay coins > lvl up > characteristics auto-upgrade
  power?: number;
  expirience?: {
    value: number;
    currentLevelExp: number;
    nextLevelExp: number;
  };
  characteristics?: BattleUnitCharacteristics;
  abilities?: BattleUnitAbility[];
  abilityList?: string[];
  quantity?: number;
  // Combat
  index?: number; // 0-34
  hp?: number;
  buffs?: BattleBuff[];
}

export interface BattleLevelScheme {
  current: number;
  next: number|null;
  price: number|null;
}

export interface BattleRewardRankingData {}

export interface BattleGameState {
  mode: string|null; // "duel" | "adventure"
  room: number|null; // 8
  difficulty: string|null; // 0, 1
  level: number|null; // 5 + 1

  userSquad: BattleSquadState;
  enemySquad: BattleSquadState;
  initiativeRating: BattleInitiativeRatingEntry[];

  terrain: BattleTerrainMap;
  combat: BattleCombatState;
}

export interface BattleInitiativeRatingEntry {
  fighterId: string;
  initiative: number;
  active: boolean;
}

export interface BattleCombatState {
  started: boolean;
  result: string|null; // "win" | "loose"
  isMyTurn: boolean|null;
  activeFighterId: string|null;
  runtime: {
    selectedIndex: number|null;
    selectedAbilityClass: string|null;
    moveCells: number[];
    attackCells: number[];
  };
}

export interface BattleSquadState {
  power: number;
  bonuses: BattleSquadBonus[];
  units: BattleUnit[];
}

export interface BattleFighterUpdate {
  fighterId: string;
  index?: number; // 0-34
  hp?: number;
  abilities?: BattleUnitAbility[];
  buffs?: BattleBuff[];
}

export interface BattleUnitCharacteristics {
  hp: number;
  damage: number;
  defence: number;
  initiative: number;
  speed: number;
}

export interface BattleTerrainMap {
  base: string;
  tiles: string[]|null[];
}

export interface BattleUnitAbility {
  abilityClass: string; // 
  abilityType: string; //
  tier: number;
  levelInt?: number;
  level?: BattleLevelScheme; // { current, next, price } unit lvl opens ability lvl > pay crystal > lvl up
  value?: number;
  enabled?: boolean;
  range?: number;
  cooldown?: {
    enabled: boolean;
    stepsLeft: number;
  }
}

export interface BattleUnitAttribute {
  attributeClass: string;
  level: number;
  initial: number;
  current: number;
}

export interface BattleBuff {
  abilityClass: string;
  type: string;
  value: number;
  probability: number;
  duration: number;
}

export interface BattleSquadBonus {
  bonusClass: string;
  modifier: number;
  max?: number;
  probability?: number;
}
