import * as april from "../../knightlands-shared/april";

export interface AprilSaveData {
  user: AprilUserState;
  map: AprilMapState;
}

export interface AprilUserState {
  balance: {
    sessionGold: number;
    gold: number;
  };
  rewards: {
    dailyRewards: AprilRewardDayData[];
    heroRewards: AprilRewardHeroesData;
    hourReward: {
      // nextRewardAvailable = 
      //   daily reward received + 1 hr,
      //   then
      //   hour reward claimed + 1 hr
      nextRewardAvailable: number|null;
      left: number;
    };
  }
  hourRewardClaimed: number|null;
  heroes: string[];
}

export interface AprilRewardHeroesData {
  [april.HERO_CLASS_KNIGHT]: AprilRewardHeroData,
  [april.HERO_CLASS_PALADIN]: AprilRewardHeroData,
  [april.HERO_CLASS_ROGUE]: AprilRewardHeroData
}

export interface AprilRewardHeroData {
  score: number;
  claimed: boolean;
}

export interface AprilRewardDayData {
  collected: boolean;
  quantity: number;
  active: boolean;
  date?: string;
}

export interface AprilMapState {
  heroClass: string;
  level: number;
  sessionResult: string;
  hp: number;
  healing: number;
  maxHp: number;
  actionPoints: number;
  prices?: {
    thirdAction: number;
    resurrection: number;
  };
  boosterCounters: {
    thirdAction: number;
    resurrection: number;
  }
  playground: AprilPlaygroundState;
  croupier: AprilCroupierState;
}

export interface AprilPlaygroundState {
  enemyWasKilled: boolean;
  units: AprilUnitBlueprint[];
  damage: number[];
  hasVictory: boolean;
}

export interface AprilCroupierState {
  newCard: string;
  deck: AprilCardBlueprint[];
  cardsInQueue: AprilCardBlueprint[];
  cards: AprilCardBlueprint[];
  usedCards: AprilCardBlueprint[];
}

export interface AprilUnitBlueprint {
  id: string;
  unitClass: string;
  index: number;
  isDead: boolean;
}

export interface AprilCardBlueprint {
  id: string;
  hash: string;
  cardClass: string;
  nextCells: number[];
  werewolf: boolean;
}
