export interface AprilSaveData {
  user: AprilUserState;
  map: AprilMapState;
}

export interface AprilUserState {
  balance: {
    sessionGold: number;
    gold: number;
  };
  dailyRewards: AprilRewardDayData[];
  hourRewardClaimed: number|null;
  heroes: string[];
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
  units: AprilUnitBlueprint[];
  damage: number[];
}

export interface AprilCroupierState {
  cardsInQueue: number;
  cards: AprilCardBlueprint[];
  usedCards: AprilCardBlueprint[];
}

export interface AprilUnitBlueprint {
  id: string;
  unitClass: string;
  index: number;
}

export interface AprilCardBlueprint {
  id: string;
  cardClass: string;
  nextCells: number[];
}
