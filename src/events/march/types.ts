export interface MarchSaveData {
  state: MarchState;
}

export interface MarchState {
}

export interface MarchBoard {
  cells: MarchCell[];
}

export interface MarchCell {
  _id: string;
  class: string;
  hp: string;
  level?: number;
  opened?: boolean;
}


