export interface XmasSaveData {
  state: XmasState;
}

export interface CPointsData {
    score: number;
    lastClaimed: number;
    shares: number;
    sharesPool: number;
    pointsPool: number;
}

export interface XmasState {
  levelGap: number;
  tower: {
    level: number;
    percentage: number;
    exp: number;
  };
  slots: { [key: number]: SlotData };
  perks: { [key: string]: CurrencyPerkData };
  balance: {
    [key: string]: number;
  },
  cpoints: CPointsData
}

export interface SlotData {
  launched: boolean;
  lastLaunch: number;
  level: number;
  accumulated: {
    currency: number;
    exp: number;
  },
  progress: {
    percentage: number;
    autoCyclesLeft: number;
    autoCyclesSpent: number;
  },
  stats: {
    cycleLength: number;
    upgrade:  {
      value: number;
      nextLevel: number;
    };
    income: {
      current: IncomeData;
      next: IncomeData;
    }
  }
}

export interface IncomeData {
  expPerSecond: number;
  expPerCycle: number;
  currencyPerSecond: number;
  currencyPerCycle: number;
}

export interface CurrencyPerkData {
  unlocked: boolean;
  tiers: { [key: string]: TierPerkData; };
}

export interface TierPerkData {
  [key: string]: {
    level: number;
    active?: boolean;
    lastActivated?: number;
  };
}
