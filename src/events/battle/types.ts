import {
  CURRENCY_COINS,
  CURRENCY_CRYSTALS
} from "../../knightlands-shared/battle";
import { BattleEffectMeta } from "./units/MetaDB";

export interface BattleSaveData {
  user: BattleUserState;
  game: BattleGameState;
  inventory: BattleUnit[];
  adventures: BattleAdventuresState;
}

export interface BattleAdventuresState {
  difficulty: string;
  location: number|null;
  level: number|null;
  locations: BattleAdventureLocation[];
}

export interface BattleAdventureLocation {
  levels: BattleAdventureLevel[]
}

export interface BattleAdventureLevel {
  reward: {
    xp: number;
    coins: number;
  },
  bossReward: {
    [CURRENCY_COINS]: number;
    [CURRENCY_CRYSTALS]: number;
  },
  enemies: {
    level: number;
    abilities: number[];
    templates: number[];
    boss: number;
  }
}

export interface BattleUserState {
  balance: {
    energy: number;
    coins: number;
    crystals: number;
  };
  items: BattleItem[];
  timers: {
    energy: number;
    purchase: {
      [date: string]: { [id: number]: number }
    }
  };
  rewards: {
    dailyRewards: BattleRewardDayData[];
    squadRewards: BattleRewardSquadData[];
  };
}

export interface BattleItem {
  id: number;
  quantity: number;
}

export interface BattleRewardDayData {
  collected: boolean;
  quantity: number;
  active: boolean;
  date?: string;
}

export interface BattleRewardSquadData {
  tribe: string;
  activeTemplates: number[];
  canClaim: boolean;
  claimed: boolean;
}

export interface BattleGameState {
  mode: string | null; // "duel" | "adventure"

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
  rewards: BattleCombatRewards;
  runtime: {
    selectedIndex: number | null;
    selectedAbilityClass: string | null;
    moveCells: number[];
    attackCells: number[];
    targetCells: number[];
  };
}

export interface BattleCombatRewards {
  coins: number;
  crystals: number;
  xp: number;
  rank: number;
}

export interface BattleSquadState {
  power: number;
  bonuses: BattleBuff[];
  fighters: BattleFighter[];
}

export interface BattleUnit {
  name: string;
  unitId?: string;
  template: number;
  tribe: string;
  class: string;
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
  name: string;
  unitId?: string;
  unitTemplate: number;
  tribe: string;
  class: string;
  fighterId: string;
  isEnemy: boolean;
  isDead: boolean;
  ratingIndex: number;
  isStunned: boolean;
  index: number | null;
  hp: number;
  buffs: BattleBuff[];
  abilities: BattleUnitAbility[];
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
  abilityType: string;
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

  caseId?: number;
  targetFighterId?: string;
  scheme?: string;
  terrain?: string;
  trigger?: string;

  stackValue?: number;
  max?: number;
}

export interface BattleShopItemMeta {
  id: number;
  name: string;
  commodity: string;
  claimable: boolean;
  price: { currency: string; amount: number; } | null;
  content: {
    units?: number;
    energy?: number;
    tierProbabilities?: number[];
    description: string[];
  };
  dailyMax: number|null;
}
