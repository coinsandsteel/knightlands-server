export interface MarchSaveData {
  user: MarchUserState;
  map: MarchMapState;
}

export interface MarchUserState {
  balance: {
    tickets: number;
    gold: number;
  };
  preGameBoosters: {
    maxHealth: number;
    extraLife: number;
    key: number;
  };
  dailyRewards: MarchRewardDayData[];
}

export interface MarchRewardDayData {
  collected: boolean;
  quantity: number;
  active: boolean;
  date?: string;
}
export interface MarchMapState {
  stat: StatState;
  pet: PetState;
  cards: MarchCard[];
}

export interface MarchCard {
  _id: string;
  unitClass: string;
  hp: number;
  maxHp?: number;
  opened?: boolean;
}

export interface StatState {
  stepsToNextBoss: number|null;
  bossesKilled: number;
  penaltySteps: number;
}

export interface PetState {
  petClass: number;
  level: number;
  armor: number;
}
export interface MarchItem {
  id: number;
  template: number;
  caption: string;
  quantity: number;
}
