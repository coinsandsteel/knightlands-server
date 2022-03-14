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
  periodicRewards: AprilPeriodicRewardDayData[];
}

export interface AprilRewardDayData {
  collected: boolean;
  quantity: number;
  active: boolean;
  date?: string;
}

export interface AprilPeriodicRewardDayData {
  quantity: number;
  timestamp: number;
}

export interface AprilMapState {
  cards: AprilCard[];
}

export interface AprilCard {
  _id: string;
  unitClass: string;
}
