export interface LunarSaveData {
  state: LunarState;
}

export interface LunarState {
  dailyRewards: LunarRewardDayData[];
  usedRecipes: number[];
}

export interface LunarItem {
  id: number;
  template: number;
  rarity: string;
  caption: string;
  quantity: number;
}

export interface LunarRewardDayData {
  collected: boolean;
  quantity: number;
  active: boolean;
  items: LunarItem[];
  date?: string;
}
