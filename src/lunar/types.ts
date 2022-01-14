export interface LunarSaveData {
  state: LunarState;
}

export interface LunarState {
  items: LunarItem[];
  lunarRewardHistory: LunarItem[][];
}

export interface LunarItem {
  id: number;
  template: number;
  caption: string;
  quantity: number;
  rarity: string;
}
