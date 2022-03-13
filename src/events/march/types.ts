export interface MarchSaveData {
  user: MarchUserState;
  map: MarchMapState;
}

export interface MarchUserState {
  balance: {
    sessionGold: number;
    gold: number;
  };
  preGameBoosters: MarchBoosters;
  dailyRewards: MarchRewardDayData[];
  pets: MarchPetData[];
}

export interface MarchBoosters {
  maxHealth: number;
  extraLife: number;
  key: number;
}

export interface MarchPetData {
  petClass: number;
  level: number;
  goldCollected: number;
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
  croupier?: CroupierState;
}

export interface MarchCard {
  _id: string;
  unitClass: string;
  hp: number;
  previousHp?: number;
  maxHp?: number;
  opened?: boolean;
  timer?: number;
  respawn?: boolean;
}

export interface StatState {
  stepsToNextBoss: number|null;
  bossesKilled: number;
}

export interface CroupierState {
  poolNumber: number;
  stepCounter: number;
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
