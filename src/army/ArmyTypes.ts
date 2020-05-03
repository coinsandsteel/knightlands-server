export interface UnitAbilityLevel {
    damage?: number;
    power?: number;
    statValue?: number;
}

export interface UnitAbilityMeta {
    id: number;
    type: string;
    unitType?: number;
    item?: number;
    max?: number;
    general?: number;
    troop?: number;
    raid?: number;
    rarity?: string;
    stars?: number;
    unitCount?: number;
    element?: string;
    stat?: string;
    weapon?: string;
    chance?: number;
    levels: UnitAbilityLevel[];
}

export interface UnitAbilitiesMeta {
    troops: { [key: string]: UnitAbilityMeta };
    general: { [key: string]: UnitAbilityMeta };
}

export interface AbilityPoolRecord {
    weight: number;
    ability: number;
}

export interface AbilityPool {
    totalWeight: number;
    abilities: AbilityPoolRecord;
}

export interface GeneralUnitMeta {
    id: number;
    unitType: number;
    stars: number;
    abilityValueMultiplier: number;
    fixedAbilities: number[];
    abilityPool: AbilityPool;
}

export interface UnitLevelingStep {
    power: number;
    gold: number;
    essence: number;
}

export interface UnitLevelingMeta {
    levelingSteps: UnitLevelingStep[];
}

export interface UnitFusionIngridient {
    unit: number;
    stars: number;
    copy: boolean;
    sameElement: boolean;
    amount: number;
    shard: boolean;
}

export interface UnitFusionRecipeTemplate {
    stars: number;
    price: number;
    ingridients: UnitFusionIngridient[];
}

export interface UnitStarsLevel {
    stars: number;
    maxLevel: number;
}

export interface UnitFusionMeta {
    templates: { [key: string]: UnitFusionRecipeTemplate };
    recipes: { [key: string]: UnitFusionRecipeTemplate };
    maxLevelByStars: UnitStarsLevel[];
}

export interface GeneralsMeta {
    units: { [key: string]: GeneralUnitMeta };
    leveling: UnitLevelingMeta;
    fusionMeta: UnitFusionMeta;
    essenceItem: number;
}

export interface TroopUnitMeta {
    id: number;
    unitType: number;
    stars: number;
    abilityValueMultiplier: number;
    element: string;
    weaponType: string;
    fixedAbilities: number[];
    abilityPool: AbilityPool;
}

export interface TroopsMeta {
    units: { [key: string]: GeneralUnitMeta };
    leveling: UnitLevelingMeta;
    fusionMeta: UnitFusionMeta;
    essenceItem: number;
}

export interface LegionSlotMeta {
    id: number;
    troop: boolean;
    levelRequired: number;
}

export interface ArmyMeta {
    soulsFromBanishment: number[];
    slots: LegionSlotMeta[];
}
