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
}

export interface AprilRewardDayData {
  collected: boolean;
  quantity: number;
  active: boolean;
  date?: string;
}

export interface AprilMapState {
  cards: AprilCard[];
}

export interface AprilCard {
  _id: string;
  unitClass: string;
}
