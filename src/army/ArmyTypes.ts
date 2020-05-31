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
    key: number; // ability id
}

export interface AbilityPool {
    totalWeight: number;
    abilities: AbilityPoolRecord[];
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

export interface UnitMeta {
    id: number;
    troop: boolean;
    unitType: number;
    stars: number;
    abilityValueMultiplier: number;
    element: string;
    weaponType: string;
    fixedAbilities: number[];
    abilityPool: AbilityPool;
}

export interface UnitsMeta {
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

export interface ArmyUnit {
    troop: boolean;
    id: number;
    template: number;
    promotions: number;
    level: number;
    abilities: number[];
}

export interface Legion {
    units: { [key: string]: number };
}

export interface UnitSummon {
    unit: number;
    weight: number;
}

export interface SummonGroup {
    stars: number;
    weight: number;
    generalsWeight: number;
    troopsWeight: number;
}

export interface SummonMetaIap {
    iap: number;
    count: number;
}

export interface SummonMeta {
    summonGroups: { [key: string]: SummonGroup };
    weights: number[];
    totalWeight: number;
    iaps: SummonMetaIap[];
}

export interface ContentMeta {
    units: UnitSummon[];
    totalWeight: number;
}

export interface ArmySummonMeta {
    normalSummon: SummonMeta;
    advancedSummon: SummonMeta;
    troops: { [stars: number]: ContentMeta };
    generals: { [stars: number]: ContentMeta };
}
