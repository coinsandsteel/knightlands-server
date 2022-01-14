export interface LunarSaveData {
  state: LunarState;
}

export interface LunarState {
  lunarRewardHistory: LunarItem[][];
}

export interface LunarItem {
  item: number;
  quantity: number;
}