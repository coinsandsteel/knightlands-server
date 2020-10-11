export interface GoldMine {
    level: number;
    storageLevel: number;
    lastUpdate: number;
    gold: number;
}

export interface GoldMinesSaveData {
    mines: GoldMine[];
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
