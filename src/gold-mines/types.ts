export interface GoldMine {
    level: number;
    lastUpdate: number;
}

export interface GoldStorage {
    level: number;
    gold: number;
}

export interface GoldMinesSaveData {
    mines: GoldMine[];
    storage: GoldStorage;
}

export interface MineUpgradeMeta {
    price: number;
    rate: number;
}

export interface StorageUpgradeMeta {
    price: number;
    size: number;
}

export interface GoldMinesMeta {
    mines: MineUpgradeMeta[];
    storage: StorageUpgradeMeta[];
    addMines: number[];
}
