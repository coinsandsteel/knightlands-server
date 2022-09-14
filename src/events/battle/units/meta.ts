export interface ClassListMeta {
  [unitClass: string]: ClassMeta
}
export interface ClassMeta {
  _id: number;
  damage: number;
  hp: number;
  defense: number;
  speed: number;
  initiativeMultiplier: number;
}

export interface EffectListMeta {
  [effectId: number]: EffectMeta
}
export interface EffectMeta {
  _id: number;
  name: string;
  target: string;
  subEffect: string;
  probability: number;
  operation: number;
  value: number;
  duration: number;
}

export interface AbilityListMeta {
  [effectId: number]: EffectMeta
}
export interface AbilityMeta {
  _id: number;
  abilityClass: string;
  abilityType: string;
  tier: number;

  baseMultiplier: number;
  finalMultiplier: number;
  levelStep: number;
  range: number[];
  canMove: number;

  targetEnemies: boolean;
  targetAllies: boolean;
  targetSelf: boolean;
  targetEmptyCell: boolean;
  ignoreTerrain: boolean;
  ignoreTerrainPenalty: boolean;
  ignoreObstacles: boolean;

  effects: EffectMeta[];
}

export interface UnitMeta {
  _id: number;
  template: number;
  name: string;
  tier: number;
  class: string;
  tribe: string;
  multiplierDamage: number;
  multiplierHp: number;
  multiplierDefence: number;
  multiplierSpeed: number;
  multiplierInitiative: number;
  levelStepDamage: number;
  levelStepHp: number;

  abilities: AbilityMeta[];
}
