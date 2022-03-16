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
  cardsInQueue: number;
  units: AprilUnit[];
  damage: number[];
  cards: AprilCard[];
  usedCards: AprilCard[];
  timesThirdActionPurchased: number;
  canBuyThirdAction: boolean;
}

export interface AprilUnit {
  id: string;
  unitClass: string;
  index: number;
}

export interface AprilCard {
  id: string;
  cardClass: string;
  nextCells: number[];
}
