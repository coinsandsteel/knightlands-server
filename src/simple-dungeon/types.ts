import DungeonEnemyMoveType from "../knightlands-shared/dungeon_enemy_move_type";

export interface DungeonLootTile {
    loot: number;
}

export interface DungeonLootConfig {
    ordered: DungeonLootTile[];
}

export interface DungeonEnemiesCompact {
    difficulty: number;
    count: number;
}

export interface DungeonEnemiesConfig {
    ordered: DungeonEnemiesCompact[];
}

export interface DungeonFloorConfig {
    width: number;
    height: number;
    extraPassageChance: number;
    missedPassageChanceInc: number;
    enemies: DungeonEnemiesConfig;
    loot: DungeonLootConfig;
}

export interface CellEnemy {
    difficulty: number;
}

export interface CellLoot {
    loot: number;
}

export interface Cell {
    x: number;
    y: number;
    c?: number[];
    enemy?: CellEnemy;
    loot?: CellLoot;
}

export interface DungeonFloorData {
    start: Cell;
    cells: Cell[];
}

export interface DungeonClientState {
    revealed: Cell[];
    energy: number;
    floor: number;
    cycle: number;
}

export interface DungeonSaveData {
    state: DungeonClientState;
    data: DungeonFloorData;
}

export interface ModeSettings {
    duration: number;
    maxFloor: number;
    floorsPerDay: number;
    maxEnergy: number;
    refillsPerDay: number;
    energyRefillCost: number;
}

export interface EnemyGroupData {
    difficulty: number;
    count: number;
}

export interface LootData {
    items: any; // legacy data type, used in all loot generation process
}

export interface DungeonFloorSettings {
    depth: number;
    width: number;
    height: number;
    enemies: EnemyGroupData[];
    loot: LootData[];
}

export interface DungeonData {
    floors: DungeonFloorSettings;
}

export interface EnemyMoveSet {
    weight: number;
    sequence: typeof DungeonEnemyMoveType[];
}

export interface EnemyData {
    id: number;
    difficulty: number;
    moves: EnemyMoveSet[];
}

export interface EnemiesData {
    enemiesById: { [key: number]: EnemyData };
    enemiesByDifficulty?: { [key: number]: EnemyData[] };
}

export interface DungeonMeta {
    mode: ModeSettings;
    dungeons: DungeonData;
    enemies: EnemiesData;
}

