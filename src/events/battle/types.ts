import { BattleEffectMeta } from "./units/MetaDB";

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
  };
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

export interface BattleRewardRankingData {}

export interface BattleGameState {
  mode: string | null; // "duel" | "adventure"
  room: number | null; // 8
  difficulty: string | null; // 0, 1
  level: number | null; // 5 + 1

  userSquad: BattleSquadState;
  enemySquad: BattleSquadState;
  initiativeRating: BattleInitiativeRatingEntry[];

  terrain: BattleTerrainMap | null;
  combat: BattleCombatState;
}

export interface BattleInitiativeRatingEntry {
  fighterId: string;
  initiative: number;
  active: boolean;
}

export interface BattleCombatState {
  started: boolean;
  result: string | null; // "win" | "loose"
  activeFighterId: string | null;
  runtime: {
    selectedIndex: number | null;
    selectedAbilityClass: string | null;
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

export interface BattleUnit {
  unitId?: string;
  template: number;
  tribe: string;
  class: string;
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
  characteristics: {
    hp: number;
    damage: number;
    defence: number;
    initiative: number;
    speed: number;
  };
  abilities: BattleUnitAbility[];
  quantity: number;
}

export interface BattleFighter extends BattleUnit {
  unitId?: string;
  unitTemplate: number;
  fighterId: string;
  isEnemy: boolean;
  isDead: boolean;
  ratingIndex: number;
  isStunned: boolean;
  index: number | null;
  hp: number;
  buffs: BattleBuff[];
}

export interface BattleLevelScheme {
  current: number;
  next: number | null;
  price: number | null;
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
  tiles: (string | null)[];
}

export interface BattleUnitAbility {
  abilityClass: string;
  tier: number;
  levelInt: number;
  level: BattleLevelScheme; // { current, next, price } unit lvl opens ability lvl > pay crystal > lvl up
  value: number;
  combatValue: number;
  enabled: boolean;
  range: {
    move: number;
    attack: number;
  };
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

export interface BattleBuff extends BattleEffectMeta {
  source: "terrain" | "pvp" | "squad";
  sourceId: string;
  mode: "stack" | "constant" | "burst";
  activated: boolean;

  targetFighterId?: string;
  scheme?: string;
  terrain?: string;
  trigger?: string;

  stackValue?: number;
  max?: number;
}
