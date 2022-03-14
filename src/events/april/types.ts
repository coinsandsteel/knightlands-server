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
  // Naming formaula: 
  // "What" + "happened": "when"
  // If no value - set null. Zero is a "1970-01-01"
  hourRewardClaimed: number|null;
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
