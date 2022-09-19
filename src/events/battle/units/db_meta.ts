export interface BattleMeta {
  settings: any;
  classes: {
    [unitClass: string]: BattleClassMeta
  };
  abilities: {
    [abilityClass: string]: BattleAbilityMeta
  };
  effects: {
    [effectId: number]: BattleEffectMeta
  };
  units: {
    [unitId: number]: BattleUnitMeta
  };
}

export interface BattleClassMeta {
  _id: number;
  damage: number;
  hp: number;
  defense: number;
  speed: number;
  initiativeMultiplier: number;
}

export interface BattleEffectMeta {
  _id: number;
  name: string;
  target: string;
  subEffect: string;
  probability: number;
  operation: number;
  value: number;
  duration: number;
}

export interface BattleRangeMeta {
  move: {
    addSpeed: boolean;
    value: number;
  };
  attack: {
    addSpeed: boolean;
    value: number;
  };
}

export interface BattleAbilityMeta {
  _id: string;
  abilityClass: string;
  tier: number;
  affectHp: boolean;
  canMove: boolean;

  baseMultiplier: number;
  finalMultiplier: number;
  levelStep: number;
  
  targetEnemies: boolean;
  targetAllies: boolean;
  targetSelf: boolean;
  targetEmptyCell: boolean;
  
  ignoreTerrain: boolean;
  ignoreTerrainPenalty: boolean;
  ignoreObstacles: boolean;
  
  // Ability level > Draw number > Effect ids
  effects: (number|BattleEffectMeta)[][][];
  range: BattleRangeMeta[];
}

export interface BattleUnitMeta {
  _id: number;
  unitClass: string;
  unitTribe: string;
  name: string;
  tier: number;

  multiplierDamage: number;
  multiplierHp: number;
  multiplierDefence: number;
  multiplierSpeed: number;
  multiplierInitiative: number;
  
  levelStepDamage: number;
  levelStepHp: number;

  abilities: (number|BattleAbilityMeta)[];
}
