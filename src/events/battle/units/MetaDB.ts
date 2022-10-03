export interface BattleMeta {
  settings: any;
  classes: {
    [unitClass: string]: BattleClassMeta;
  };
  abilities: {
    [abilityClass: string]: BattleAbilityMeta;
  };
  effects: {
    [effectId: number]: BattleEffectMeta;
  };
  units: {
    [unitId: number]: BattleUnitMeta;
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
  _id?: number;
  name: string;
  target: "no" | "damage" | "defence" | "speed" | "initiative" | "hp" | "attack" | "power" | "abilities";
  subEffect: "no" | "stun" | "agro" | "lava_damage" | "counter_attack";
  operation: "multiply" | "add";
  probability: number;
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
  _id: string|number;
  abilityClass: string;
  abilityType?: string;
  tier: number;
  affectHp: boolean;
  affectFullSquad: boolean;
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

  effectList: number[][][];
  effects?: BattleEffectMeta[][][]; // Ability level > Draw number > Effect ids

  range: BattleRangeMeta[];
}

export interface BattleUnitMeta {
  _id: number;
  class: string;
  tribe: string;
  name: string;
  tier: number;

  multipliers: {
    damage: number;
    hp: number;
    defence: number;
    speed: number;
    initiative: number;
  };

  levelSteps: {
    damage: number;
    hp: number;
  };

  abilityList: string[];
  abilities?: BattleAbilityMeta[];
}
