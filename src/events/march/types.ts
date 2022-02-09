export interface MarchSaveData {
  user: MarchUserState;
  map: MarchMapState;
}

export interface MarchUserState {
  balance: {
    tickets: number;
    gold: number;
  };
  boosters: {
    maxHealth: number;
    extraLife: number;
    key: number;
  }
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


