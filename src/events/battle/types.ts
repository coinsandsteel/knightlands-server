import { BattleEffectMeta, BattleRangeMeta } from "./units/MetaDB";

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
  unitId: string;
  template: number;
  unitTribe: string;
  unitClass: string;
  name: string;
  tier: number;
  level: BattleLevelScheme;
  levelInt: number;
  power: number;
  expirience: {
    value: number;
    currentLevelExp: number;
    nextLevelExp: number;
  };
  characteristics: BattleUnitCharacteristics;
  abilities: BattleUnitAbility[];
  quantity: number;
}

export interface BattleFighter extends BattleUnit {
  unitId: string;
  fighterId: string;
  isEnemy: boolean;
  isDead: boolean;
  ratingIndex: number;
  isStunned: boolean;
  index: number|null;
  hp: number;
  buffs: BattleBuff[];
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

  terrain: BattleTerrainMap|null;
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
  activeFighterId: string|null;
  runtime: {
    selectedIndex: number|null;
    selectedAbilityClass: string|null;
    moveCells: number[];
    attackCells: number[];
    targetCells: number[];
  };
}

export interface BattleSquadState {
  power: number;
  bonuses: BattleBuff[];
  fighters: BattleFighter[];
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
  tiles: (string|null)[];
}

export interface BattleUnitAbility {
  abilityClass: string;
  tier: number;
  levelInt: number;
  level: BattleLevelScheme; // { current, next, price } unit lvl opens ability lvl > pay crystal > lvl up
  value: number;
  combatValue: number;
  enabled: boolean;
  range: BattleRangeMeta;
  cooldown?: {
    enabled: boolean;
    estimate: number;
  };
  effects: BattleEffectMeta[][];
}

export interface BattleUnitAttribute {
  attributeClass: string;
  level: number;
  initial: number;
  current: number;
}

export interface BattleBuff {
  source?: string;
  sourceId?: string;
  type: string;
  mode: string;
  targetFighterId?: string;
  stackValue?: number;
  modifier?: number;
  scheme?: string;
  delta?: number;
  probability?: number;
  terrain?: string;
  trigger?: string;
  multiply?: boolean;
  sum?: boolean;
  fullSquad?: boolean;
  max?: number;
  estimate?: number;
  activated?: boolean;
  caseId?: number;
}