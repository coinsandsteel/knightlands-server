export interface MarchSaveData {
  user: MarchUserState;
  map: MarchMapState;
}

export interface MarchUserState {
  balance: {
    tickets: number;
    gold: number;
  },
  boosters: {
    maxHealth: number;
    extraLife: number;
    key: number;
  }
}

export interface MarchMapState {
  stat: {
    stepsToNextBoss: number|null;
    bossesKilled: number;
    penaltySteps: number;
  },
  pet: PetState,
  cards: MarchCard[]
}

export interface MarchCard {
  _id: string;
  unitClass: string;
  hp: number;
  opened?: boolean;
}

export interface PetState {
  maxHp: number;
  petClass: number;
  level: number;
  armor: number;
}


