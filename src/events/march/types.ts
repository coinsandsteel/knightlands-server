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
  },
  pet: {
    penaltySteps: number;
    class: number;
    level: number;
    armor: number;
  },
  cells: MarchCell[]
}

export interface MarchCell {
  _id: string;
  class: string;
  hp: string;
  opened?: boolean;
}


