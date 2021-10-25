import { MoveType, AltarType, TrapType } from "../knightlands-shared/dungeon_types";

export interface CompactedConfig {
    count: number;
}

export interface DungeonLootTile {
    loot: number;
}

export interface HasId {
    id: number;
}

export interface DungeonAltarTile extends HasId {

}

export interface DungeonTrapTile extends HasId {

}

export interface DungeonEnemiesCompact extends CompactedConfig {
    difficulty: number;
}

export interface DungeonAltarsCompact extends CompactedConfig, HasId {

}

export interface DungeonTrapsCompact extends CompactedConfig, HasId {

}

export interface DungeonFloorConfig {
    width: number;
    height: number;
    extraPassageChance: number;
    missedPassageChanceInc: number;
    enemies: DungeonEnemiesCompact[];
    loot: DungeonLootTile[];
    altars: DungeonAltarsCompact[];
    traps: DungeonTrapsCompact[];
}

export interface CellEnemy {
    id: number;
}

export interface Cell {
    x: number;
    y: number;
    c?: number[];
    enemy?: CellEnemy;
    loot?: DungeonLootTile;
    altar?: DungeonAltarTile;
    trap?: DungeonTrapTile;
}

export interface DungeonFloorData {
    start: Cell;
    cells: Cell[];
    width: number;
}

export interface DungeonUserState {
    level: number;
    cell: number;
    energy: number;
    health: number,
    lastHpRegen: number;
    lastEnergyRegen: number;
}

export interface CombatState {
    turn: number;
    enemyHealth: number;
    enemyId: number;
    moveSetId: number;
    moveIndex: number;
}

export interface DungeonClientState {
    revealed: Cell[];
    floor: number;
    cycle: number;
    defuseFails: number;
    user: DungeonUserState;
    combat?: CombatState;
}

export interface DungeonClientData extends DungeonClientState {
    width: number;
    height: number;
}

export interface DungeonSaveData {
    state: DungeonClientState;
    data: DungeonFloorData;
}

export interface ModeSettings {
    duration: number;
    maxFloor: number;
    floorsPerDay: number;
    dailyEnergy: number;
}

export interface EnemyGroupData {
    difficulty: number;
    count: number;
}

export interface LootData {
    items: any; // legacy data type, used in all loot generation process
}

export interface DungeonData {
    floors: DungeonFloorConfig;
}

export interface EnemyMoveSet {
    weight: number;
    sequence: number[];
    minHealth: number;
    maxHealth: number;
    index: number;
}

export interface EnemyData {
    id: number;
    difficulty: number;
    health: number;
    defense: number;
    attack: number;
    moves: EnemyMoveSet[];
    isAgressive: boolean;
}

export interface EnemiesData {
    enemiesById: { [key: number]: EnemyData };
    enemiesByDifficulty?: { [key: number]: EnemyData[] };
}

export interface EnergyCostSettings {
    move: number;
    chest: number;
    trap: number;
    altar: number;
}

export interface AltarData {
    id: number;
    type: number;
    restoreValue: number;
}

export interface AltarsData {
    altars: { [key: number]: AltarData };
}

export interface TrapData {
    id: number;
    type: number;
    damage: number;
}

export interface JammingChanceData {
    hidden: number;
    revealed: number;
}

export interface TrapsData {
    traps: { [key: number]: TrapData };
    jammingChance: JammingChanceData[];
}

export interface DungeonMeta {
    costs: EnergyCostSettings;
    mode: ModeSettings;
    dungeons: DungeonData;
    enemies: EnemiesData;
    altars: AltarsData;
    traps: TrapsData;
}