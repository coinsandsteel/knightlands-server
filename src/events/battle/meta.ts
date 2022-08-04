import * as battle from "./../../knightlands-shared/battle";
import { BattleUnitAbilityBlueprint } from "./types";

export const PATH_SCHEME_ROOK = "rook";
export const PATH_SCHEME_QUEEN = "queen";

export const TERRAIN_ICE = "ice";
export const TERRAIN_SWAMP = "swamp";
export const TERRAIN_LAVA = "lava";
export const TERRAIN_THORNS = "thorns";
export const TERRAIN_WOODS = "woods";
export const TERRAIN_HILL = "hill";

export const SETTINGS = {
  lavaDamage: 0.05, // by maxHp
  maxExp: 99000,
  moveScheme: PATH_SCHEME_ROOK,
  maxUnitTierLevel: {
    1: 15, 
    2: 30, 
    3: 45
  },
  terrain: {
    [TERRAIN_ICE]: { 
      type: "damage",  
      modifiers: {
        "ice-0": 1.25,
        "ice-1": 1.187,
        "ice-2": 1.12,   
        "ice-3": 1.0625,
        "ice-4": 1
      }
    },
    [TERRAIN_HILL]:  { 
      type: "power",   
      modifiers: {
        "hill-0": 1.25,
        "hill-1": 1.3125,
        "hill-2": 1.375,   
        "hill-3": 1.4375,
        "hill-4": 1.5
      }
    },
    [TERRAIN_WOODS]: { 
      type: "defence", 
      modifiers: {
        "woods-0": 1.25,
        "woods-1": 1.3125,
        "woods-2": 1.375,   
        "woods-3": 1.4375,
        "woods-4": 1.5
      }
    },
    [TERRAIN_SWAMP]: { 
      type: "speed",   
      modifiers: {
        "swamp-0": 0.5,
        "swamp-1": 0.375,
        "swamp-2": 0.25,   
        "swamp-3": 0.125,
        "swamp-4": 0
      }
    },
    [TERRAIN_LAVA]:  { 
      type: "damage",  
      modifiers: {
        "lava-0": 0.05,
        "lava-1": 0.0375,
        "lava-2": 0.025,   
        "lava-3": 0.0125,
        "lava-4": 0
      }
    },
  }
};

export const AVG_HP = 70.7;
export const AVG_DMG = 7.1;
export const CHARACTERISTICS = {
  [battle.UNIT_CLASS_MELEE]: {
    multipliers: { hp: 1, damage: 1 },
    base: [
      { defence: 3, speed: 2, initiative: 4, defIncrement: 2/15 },
      { defence: 6, speed: 2, initiative: 4, defIncrement: 4/15 },
      { defence: 11, speed: 3, initiative: 6, defIncrement: 4/15 }
    ]
  },
  [battle.UNIT_CLASS_RANGE]: {
    multipliers: { hp: 0.7, damage: 1.3 },
    base: [
      { defence: 2, speed: 3, initiative: 6, defIncrement: 2/15 },
      { defence: "lvl-6", speed: 3, initiative: 6, defIncrement: 3/15 },
      { defence: "lvl-6", speed: 4, initiative: 8, defIncrement: 3/15 }
    ]
  },
  [battle.UNIT_CLASS_MAGE]: {
    multipliers: { hp: 0.6, damage: 1.5 },
    base: [
      { defence: 1, speed: 2, initiative: 4, defIncrement: 2/15 },
      { defence: "lvl-6", speed: 2, initiative: 4, defIncrement: 2/15 },
      { defence: "lvl-6", speed: 3, initiative: 6, defIncrement: 2/15 }
    ]
  },
  [battle.UNIT_CLASS_TANK]: {
    multipliers: { hp: 1.3, damage: 0.7 },
    base: [
      { defence: 10, speed: 2, initiative: 4, defIncrement: 5/15 },
      { defence: "lvl-6", speed: 2, initiative: 4, defIncrement: 5/15 },
      { defence: "lvl-6", speed: 3, initiative: 6, defIncrement: 5/15 }
    ]
  },
  [battle.UNIT_CLASS_SUPPORT]: {
    multipliers: { hp: 0.7, damage: 1 },
    base: [
      { defence: 10, speed: 2, initiative: 4, defIncrement: 5/15 },
      { defence: "lvl-6", speed: 2, initiative: 4, defIncrement: 5/15 },
      { defence: "lvl-6", speed: 3, initiative: 6, defIncrement: 5/15 }
    ]
  },
};

export const BUFF_SOURCE_SQUAD = 'squad';
export const BUFF_SOURCE_TERRAIN = 'terrain';
export const BUFF_SOURCE_BUFF = 'buff';
export const BUFF_SOURCE_SELF_BUFF = 'self_buff';
export const BUFF_SOURCE_DE_BUFF = 'de_buff';

export const ABILITIES = {
  [battle.UNIT_CLASS_MELEE]: {
    [battle.ABILITY_POWER_STRIKE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [12, 14, 16, 17, 19],
        [21, 23, 25, 26, 28],
        [30, 32, 34, 35, 37]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false, // TODO implement
      duration: null,
      effects: []
    },
    [battle.ABILITY_AXE_BLOW]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [12, 14, 16, 17, 19],
        [21, 23, 25, 26, 28],
        [30, 32, 34, 35, 37]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_SPEAR_STRIKE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [12, 14, 16, 17, 19],
        [21, 23, 25, 26, 28],
        [30, 32, 34, 35, 37]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_STRONG_PUNCH]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [12, 14, 16, 17, 19],
        [21, 23, 25, 26, 28],
        [30, 32, 34, 35, 37]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_DRAGON_BITE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [18, 20, 23, 26, 28],
        [31, 34, 36, 39, 42],
        [44, 47, 49, 52, 55]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_SWORD_CRUSH]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [31, 34, 38, 42],
        [45, 49, 52, 56]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_AXE_CRUSH]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [31, 34, 38, 42],
        [45, 49, 52, 56]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_WOLF_BITE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [31, 34, 38, 42],
        [45, 49, 52, 56]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_FURY_CLAWS]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [31, 34, 38, 42],
        [45, 49, 52, 56]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_KUNAI_STRIKE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [31, 34, 38, 42],
        [45, 49, 52, 56]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_FIRE_BLADE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [31, 34, 38, 42],
        [45, 49, 52, 56]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_FROST_BLADE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [31, 34, 38, 42],
        [45, 49, 52, 56]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_STUN]: {
      abilityType: battle.ABILITY_TYPE_DE_BUFF,
      damage: [null, [9, 10, 11, 12],
        [13, 14, 15, 16]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: [ // Ability lvl
        // TODO stun
        [{ type: "stun", mode: "burst", probability: 0.5, estimate: 1 }], // Turns
        [{ type: "stun", mode: "burst", probability: 0.6, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 0.7, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 0.8, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 0.9, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 1, estimate: 1 }, ],
        [{ type: "stun", mode: "burst", probability: 1, estimate: 1 }, { type: "stun", mode: "burst", probability: 0.15, estimate: 2 }],
        [{ type: "stun", mode: "burst", probability: 1, estimate: 1 }, { type: "stun", mode: "burst", probability: 0.25, estimate: 2 }],
      ],
    },
    [battle.ABILITY_RUSH]: {
      abilityType: battle.ABILITY_TYPE_JUMP,
      damage: [null, [9, 10, 11, 12],
        [13, 14, 15, 16]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed+1",
      attackRange: 1,
      ignoreObstacles: [false, false, false, false, false, false, false, true],
      duration: null,
      effects: []
    },
    [battle.ABILITY_FLIGHT]: {
      abilityType: battle.ABILITY_TYPE_FLIGHT,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: ["speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+3"],
      attackRange: null,
      ignoreObstacles: true,
      duration: null,
      effects: []
    },
    [battle.ABILITY_RAGE]: {
      abilityType: battle.ABILITY_TYPE_SELF_BUFF,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: null,
      ignoreObstacles: false,
      duration: 3,
      effects: [ // Ability lvl
        [{ type: "power", mode: "constant", modifier: 1.15 }],
        [{ type: "power", mode: "constant", modifier: 1.20 }],
        [{ type: "power", mode: "constant", modifier: 1.25 }],
        [{ type: "power", mode: "constant", modifier: 1.30 }],
        [{ type: "power", mode: "constant", modifier: 1.35 }],
        [{ type: "power", mode: "constant", modifier: 1.40 }],
        [{ type: "power", mode: "constant", modifier: 1.45 }],
        [{ type: "power", mode: "constant", modifier: 1.50 }],
      ],
    },
    [battle.ABILITY_ZEALOT]: {
      abilityType: battle.ABILITY_TYPE_SELF_BUFF,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: null,
      ignoreObstacles: false,
      duration: 3,
      effects: [
        [{ type: "power", mode: "constant", modifier: 1.15 }],
        [{ type: "power", mode: "constant", modifier: 1.20 }],
        [{ type: "power", mode: "constant", modifier: 1.25 }],
        [{ type: "power", mode: "constant", modifier: 1.30 }],
        [{ type: "power", mode: "constant", modifier: 1.35 }],
        [{ type: "power", mode: "constant", modifier: 1.40 }],
        [{ type: "power", mode: "constant", modifier: 1.45 }],
        [{ type: "power", mode: "constant", modifier: 1.50 }],
      ]
    },
    [battle.ABILITY_LETHAL_STRIKE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [53, 60, 68]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_FATAL_STRIKE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [53, 60, 68]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_BLADE_VORTEX]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [53, 60, 68]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_CRUSH_OF_DOOM]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [53, 60, 68]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_DRAGON_FURY]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [53, 60, 68]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_FROZEN_ABYSS]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [44, 50, 57]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: 1,
      effects: [
        [{ type: "speed", mode: "constant", modifier: 0.8 }],
        [{ type: "speed", mode: "constant", modifier: 0.7 }],
        [{ type: "speed", mode: "constant", modifier: 0.6 }],
      ]
    },
    [battle.ABILITY_ATTACK]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: null,
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
  },
  [battle.UNIT_CLASS_RANGE]: {
    [battle.ABILITY_JAVELIN_THROW]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [16, 18, 20, 23, 25],
        [27, 30, 32, 34, 37],
        [39, 41, 44, 46, 48]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_POWER_SHOT]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [16, 18, 20, 23, 25],
        [27, 30, 32, 34, 37],
        [39, 41, 44, 46, 48]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_DOUBLE_SHOT]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [40, 45, 49, 54],
        [59, 63, 68, 72]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_ACCURATE_SHOT]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [40, 45, 49, 54],
        [59, 63, 68, 72]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_ARROW_CRUSH]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [40, 45, 49, 54],
        [59, 63, 68, 72]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_STUN_SHOT]: {
      abilityType: battle.ABILITY_TYPE_DE_BUFF,
      damage: [null, [11, 13, 14, 15],
        [16, 18, 19, 20]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: [ // Ability lvl
        [{ type: "stun", mode: "burst", probability: 0.5, estimate: 1 }], // Turns
        [{ type: "stun", mode: "burst", probability: 0.6, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 0.7, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 0.8, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 0.9, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 1, estimate: 1 }, ],
        [{ type: "stun", mode: "burst", probability: 1, estimate: 1 }, { type: "stun", mode: "burst", probability: 0.15, estimate: 2 }],
        [{ type: "stun", mode: "burst", probability: 1, estimate: 1 }, { type: "stun", mode: "burst", probability: 0.25, estimate: 2 }],
      ],
      },
    [battle.ABILITY_DASH]: {
      abilityType: battle.ABILITY_TYPE_JUMP,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed+1",
      attackRange: null,
      ignoreObstacles: [false, false, false, false, false, false, false, true],
      duration: null,
      effects: []
    },
    [battle.ABILITY_FLIGHT]: {
      abilityType: battle.ABILITY_TYPE_FLIGHT,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: ["speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+3"],
      attackRange: null,
      ignoreObstacles: true,
      duration: null,
      effects: []
    },
    [battle.ABILITY_HEAVY_ARROW]: {
      abilityType: battle.ABILITY_TYPE_SELF_BUFF,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: null,
      ignoreObstacles: false,
      duration: 3,
      effects: [ // Ability lvl
        [{ type: "power", mode: "constant", modifier: 1.15 }],
        [{ type: "power", mode: "constant", modifier: 1.20 }],
        [{ type: "power", mode: "constant", modifier: 1.25 }],
        [{ type: "power", mode: "constant", modifier: 1.30 }],
        [{ type: "power", mode: "constant", modifier: 1.35 }],
        [{ type: "power", mode: "constant", modifier: 1.40 }],
        [{ type: "power", mode: "constant", modifier: 1.45 }],
        [{ type: "power", mode: "constant", modifier: 1.50 }],
      ],
    },
    [battle.ABILITY_DEATH_SHOT]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [69, 79, 88]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_LETHAL_SHOT]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [69, 79, 88]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_HAMSTRING]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [57, 65, 74]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: 1,
      effects: [
        [{ type: "speed", mode: "constant", modifier: 0.8 }],
        [{ type: "speed", mode: "constant", modifier: 0.7 }],
        [{ type: "speed", mode: "constant", modifier: 0.6 }],
      ]
    },
    [battle.ABILITY_ATTACK]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: null,
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
  },
  [battle.UNIT_CLASS_MAGE]: {
    [battle.ABILITY_FLAME_STRIKE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [18, 21, 23, 26, 29],
        [32, 34, 37, 40, 42],
        [45, 48, 50, 53, 56]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_ENERGY_BOLT]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [46, 52, 57, 62],
        [68, 73, 78, 84]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_HURRICANE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [46, 52, 57, 62],
        [68, 73, 78, 84]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_DARK_VORTEX]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [80, 91, 102]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_ATTACK]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: null,
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
  },
  [battle.UNIT_CLASS_TANK]: {
    [battle.ABILITY_AGRESSION]: {
      abilityType: battle.ABILITY_TYPE_DE_BUFF,
      damage: [
        [14, 16, 18, 20, 21],
        [22, 24, 25, 27, 29],
        [30, 32, 34, 37, 39]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: [ // Ability lvl
        [{ type: "agro", mode: "burst", probability: 0.50, estimate: 1 }], // Turns
        [{ type: "agro", mode: "burst", probability: 0.55, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.60, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.60, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.65, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.70, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.75, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.80, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.80, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.85, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.90, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 0.95, estimate: 1 }],
        [{ type: "agro", mode: "burst", probability: 1, estimate: 1 }, ],
        [{ type: "agro", mode: "burst", probability: 1, estimate: 1 }, { type: "agro", probability: 0.10, estimate: 2 }],
        [{ type: "agro", mode: "burst", probability: 1, estimate: 1 }, { type: "agro", probability: 0.20, estimate: 2 }],
        [{ type: "agro", mode: "burst", probability: 1, estimate: 1 }, { type: "agro", probability: 0.30, estimate: 2 }],
        [{ type: "agro", mode: "burst", probability: 1, estimate: 1 }, { type: "agro", probability: 0.40, estimate: 2 }],
        [{ type: "agro", mode: "burst", probability: 1, estimate: 1 }, { type: "agro", probability: 0.50, estimate: 2 }],
      ],
    },
    [battle.ABILITY_HOLY_STRIKE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [8, 10, 11, 12, 13],
        [15, 16, 17, 19, 20],
        [21, 22, 24, 25, 26]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_MORTAL_BLOW]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [8, 10, 11, 12, 13],
        [15, 16, 17, 19, 20],
        [21, 22, 24, 25, 26]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_HEAVY_STRIKE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [
        [8, 10, 11, 12, 13],
        [15, 16, 17, 19, 20],
        [21, 22, 24, 25, 26]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_SHIELD_STRIKE]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, [22, 24, 27, 29],
        [32, 34, 37, 39]
      ],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_RUSH]: {
      abilityType: battle.ABILITY_TYPE_JUMP,
      damage: [null, [6, 7, 8, 9],
        [10, 11, 12, 14]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed+1",
      attackRange: 1,
      ignoreObstacles: [false, false, false, false, false, false, false, true],
      duration: null,
      effects: []
    },
    [battle.ABILITY_FLIGHT]: {
      abilityType: battle.ABILITY_TYPE_FLIGHT,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: ["speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+3"],
      attackRange: null,
      ignoreObstacles: true,
      duration: null,
      effects: []
    },
    [battle.ABILITY_TELEPORTATION]: {
      abilityType: battle.ABILITY_TYPE_FLIGHT,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: ["speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+2", "speed+3"],
      attackRange: null,
      ignoreObstacles: true,
      duration: null,
      effects: []
    },
    [battle.ABILITY_HUMMER_BLOW]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [37, 42, 48]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_RETRIBUTION]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: [null, null, [37, 42, 48]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_SHIELD_STUN]: {
      abilityType: battle.ABILITY_TYPE_DE_BUFF,
      damage: [null, null, [9, 10, 11]],
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: [
        [{ type: "stun", mode: "burst", probability: 0.7, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 1, estimate: 1 }],
        [{ type: "stun", mode: "burst", probability: 1, estimate: 1 }, { type: "stun", probability: 0.3, estimate: 2 }]
      ]
    },
    [battle.ABILITY_SHIELD_WALL]: {
      abilityType: battle.ABILITY_TYPE_SELF_BUFF,
      damage: [null, null, [52, 63, 74]],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: null,
      ignoreObstacles: false,
      duration: 1,
      effects: [
        [{ type: "defence", mode: "constant", modifier: 1.75, estimate: 1 }],
        [{ type: "defence", mode: "constant", modifier: 2, estimate: 1 }],
        [{ type: "defence", mode: "constant", modifier: 2.25, estimate: 1 }],
      ]
    },
    [battle.ABILITY_ATTACK]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: null,
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: true,
      moveRange: "speed-1",
      attackRange: 1,
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
  },
  [battle.UNIT_CLASS_SUPPORT]: {
    [battle.ABILITY_HEAL]: {
      abilityType: battle.ABILITY_TYPE_HEALING,
      damage: [
        [18, 20, 23, 26, 28],
        [31, 34, 36, 39, 42],
        [44, 47, 49, 52, 55]
      ],
      damageScheme: 1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed+2",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_SHIELD]: {
      abilityType: battle.ABILITY_TYPE_BUFF,
      damage: [
        [14, 16, 18, 20, 22],
        [24, 26, 28, 30, 32],
        [33, 34, 35, 37, 39]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed+2",
      ignoreObstacles: false,
      duration: 2,
      effects: [ // Ability lvl
        [{ type: "defence", mode: "constant", modifier: 1.15 }],
        [{ type: "defence", mode: "constant", modifier: 1.18 }],
        [{ type: "defence", mode: "constant", modifier: 1.20 }],
        [{ type: "defence", mode: "constant", modifier: 1.21 }],
        [{ type: "defence", mode: "constant", modifier: 1.24 }],
        [{ type: "defence", mode: "constant", modifier: 1.27 }],
        [{ type: "defence", mode: "constant", modifier: 1.30 }],
        [{ type: "defence", mode: "constant", modifier: 1.32 }],
        [{ type: "defence", mode: "constant", modifier: 1.35 }],
        [{ type: "defence", mode: "constant", modifier: 1.38 }],
        [{ type: "defence", mode: "constant", modifier: 1.40 }],
        [{ type: "defence", mode: "constant", modifier: 1.42 }],
        [{ type: "defence", mode: "constant", modifier: 1.45 }],
        [{ type: "defence", mode: "constant", modifier: 1.48 }],
        [{ type: "defence", mode: "constant", modifier: 1.50 }],
      ],
    },
    [battle.ABILITY_CURSE]: {
      abilityType: battle.ABILITY_TYPE_DE_BUFF,
      damage: [
        [14, 16, 18, 20, 22],
        [24, 26, 28, 30, 32],
        [33, 34, 35, 37, 39]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed+2",
      ignoreObstacles: false,
      duration: 2,
      effects: [ // Ability lvl
        [{ type: "defence", mode: "constant", modifier: 0.85 }],
        [{ type: "defence", mode: "constant", modifier: 0.82 }],
        [{ type: "defence", mode: "constant", modifier: 0.80 }],
        [{ type: "defence", mode: "constant", modifier: 0.79 }],
        [{ type: "defence", mode: "constant", modifier: 0.76 }],
        [{ type: "defence", mode: "constant", modifier: 0.73 }],
        [{ type: "defence", mode: "constant", modifier: 0.70 }],
        [{ type: "defence", mode: "constant", modifier: 0.68 }],
        [{ type: "defence", mode: "constant", modifier: 0.65 }],
        [{ type: "defence", mode: "constant", modifier: 0.62 }],
        [{ type: "defence", mode: "constant", modifier: 0.60 }],
        [{ type: "defence", mode: "constant", modifier: 0.58 }],
        [{ type: "defence", mode: "constant", modifier: 0.55 }],
        [{ type: "defence", mode: "constant", modifier: 0.52 }],
        [{ type: "defence", mode: "constant", modifier: 0.50 }],
      ],
    },
    [battle.ABILITY_MIGHT]: {
      abilityType: battle.ABILITY_TYPE_BUFF,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed+2",
      ignoreObstacles: false,
      duration: 2,
      effects: [
        [{ type: "power", mode: "constant", modifier: 1.15 }],
        [{ type: "power", mode: "constant", modifier: 1.20 }],
        [{ type: "power", mode: "constant", modifier: 1.25 }],
        [{ type: "power", mode: "constant", modifier: 1.30 }],
        [{ type: "power", mode: "constant", modifier: 1.35 }],
        [{ type: "power", mode: "constant", modifier: 1.40 }],
        [{ type: "power", mode: "constant", modifier: 1.45 }],
        [{ type: "power", mode: "constant", modifier: 1.50 }],
      ]
    },
    [battle.ABILITY_WEAKNESS]: {
      abilityType: battle.ABILITY_TYPE_DE_BUFF,
      damage: [null, [30, 34, 38, 40],
        [42, 45, 51, 56]
      ],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed+2",
      ignoreObstacles: false,
      duration: 2,
      effects: [
        [{ type: "power", mode: "constant", modifier: 0.85 }],
        [{ type: "power", mode: "constant", modifier: 0.80 }],
        [{ type: "power", mode: "constant", modifier: 0.75 }],
        [{ type: "power", mode: "constant", modifier: 0.70 }],
        [{ type: "power", mode: "constant", modifier: 0.65 }],
        [{ type: "power", mode: "constant", modifier: 0.60 }],
        [{ type: "power", mode: "constant", modifier: 0.55 }],
        [{ type: "power", mode: "constant", modifier: 0.50 }],
      ]
    },
    [battle.ABILITY_GROUP_HEAL]: {
      abilityType: battle.ABILITY_TYPE_HEALING,
      damage: [null, null, [30, 34, 38]],
      damageScheme: 1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed+2",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
    [battle.ABILITY_WIND_WALK]: {
      abilityType: battle.ABILITY_TYPE_BUFF,
      damage: [null, null, [52, 63, 74]],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed+2",
      ignoreObstacles: false,
      duration: 2,
      effects: [
        [{ type: "speed", mode: "constant", modifier: 1.2 }],
        [{ type: "speed", mode: "constant", modifier: 1.25 }],
        [{ type: "speed", mode: "constant", modifier: 1.3 }],
      ]
    },
    [battle.ABILITY_LAZINESS]: {
      abilityType: battle.ABILITY_TYPE_DE_BUFF,
      damage: [null, null, [52, 63, 74]],
      damageScheme: null,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed+2",
      ignoreObstacles: false,
      duration: 2,
      effects: [
        [{ type: "initiative", mode: "constant", modifier: 0.8 }],
        [{ type: "initiative", mode: "constant", modifier: 0.75 }],
        [{ type: "initiative", mode: "constant", modifier: 0.7 }],
      ]
    },
    [battle.ABILITY_ATTACK]: {
      abilityType: battle.ABILITY_TYPE_ATTACK,
      damage: null,
      damageScheme: -1,
      movePattern: PATH_SCHEME_ROOK,
      canMove: false,
      moveRange: null,
      attackRange: "speed",
      ignoreObstacles: false,
      duration: null,
      effects: []
    },
  }
} as { 
  [unitClass: string]: {
    [abilityClass: string]: BattleUnitAbilityBlueprint 
  }
};

export const UNITS = [
  //battle.UNIT_TRIBE_KOBOLD
  {
    template: 1,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 2,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_JAVELIN_THROW,
      battle.ABILITY_FLIGHT,
      battle.ABILITY_LETHAL_SHOT,
    ]
  },
  {
    template: 3,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 4,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_MORTAL_BLOW,
      battle.ABILITY_FLIGHT,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 5,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_HEAL,
      battle.ABILITY_MIGHT,
      battle.ABILITY_LAZINESS,
    ]
  },
  // battle.UNIT_TRIBE_DWARF
  {
    template: 6,
    unitTribe: battle.UNIT_TRIBE_DWARF,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_STUN,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 7,
    unitTribe: battle.UNIT_TRIBE_DWARF,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_AXE_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 8,
    unitTribe: battle.UNIT_TRIBE_DWARF,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_RUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 9,
    unitTribe: battle.UNIT_TRIBE_DWARF,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_HEAVY_STRIKE,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  // battle.UNIT_TRIBE_EGYPTIAN
  {
    template: 10,
    unitTribe: battle.UNIT_TRIBE_EGYPTIAN,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_ACCURATE_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 11,
    unitTribe: battle.UNIT_TRIBE_EGYPTIAN,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_DASH,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 12,
    unitTribe: battle.UNIT_TRIBE_EGYPTIAN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_AXE_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 13,
    unitTribe: battle.UNIT_TRIBE_EGYPTIAN,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_HEAVY_STRIKE,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 14,
    unitTribe: battle.UNIT_TRIBE_EGYPTIAN,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_HEAL,
      battle.ABILITY_MIGHT,
      battle.ABILITY_WIND_WALK,
    ]
  },
  // battle.UNIT_TRIBE_GOBLIN
  {
    template: 15,
    unitTribe: battle.UNIT_TRIBE_GOBLIN,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 16,
    unitTribe: battle.UNIT_TRIBE_GOBLIN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 17,
    unitTribe: battle.UNIT_TRIBE_GOBLIN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_SPEAR_STRIKE,
      battle.ABILITY_WOLF_BITE,
      battle.ABILITY_FATAL_STRIKE,
    ]
  },
  {
    template: 18,
    unitTribe: battle.UNIT_TRIBE_GOBLIN,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_HOLY_STRIKE,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 19,
    unitTribe: battle.UNIT_TRIBE_GOBLIN,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_WEAKNESS,
      battle.ABILITY_LAZINESS,
    ]
  },
  // battle.UNIT_TRIBE_INSECT
  {
    template: 20,
    unitTribe: battle.UNIT_TRIBE_INSECT,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 21,
    unitTribe: battle.UNIT_TRIBE_INSECT,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 22,
    unitTribe: battle.UNIT_TRIBE_INSECT,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 23,
    unitTribe: battle.UNIT_TRIBE_INSECT,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 24,
    unitTribe: battle.UNIT_TRIBE_INSECT,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_MIGHT,
      battle.ABILITY_HEAL,
    ]
  },
  // battle.UNIT_TRIBE_ORC
  {
    template: 25,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_HEAVY_ARROW,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 26,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RAGE,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 27,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_RUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 28,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_RUSH,
      battle.ABILITY_RETRIBUTION,
    ]
  },
  {
    template: 29,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_CURSE,
      battle.ABILITY_MIGHT,
      battle.ABILITY_LAZINESS,
    ]
  },
  // battle.UNIT_TRIBE_ASSEMBLING
  {
    template: 30,
    unitTribe: battle.UNIT_TRIBE_ASSEMBLING,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 31,
    unitTribe: battle.UNIT_TRIBE_ASSEMBLING,
    unitClass: battle.UNIT_CLASS_MAGE,
    abilityList: [
      battle.ABILITY_FLAME_STRIKE,
      battle.ABILITY_ENERGY_BOLT,
      battle.ABILITY_DARK_VORTEX,
    ]
  },
  {
    template: 32,
    unitTribe: battle.UNIT_TRIBE_ASSEMBLING,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_STUN,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 33,
    unitTribe: battle.UNIT_TRIBE_ASSEMBLING,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_RUSH,
      battle.ABILITY_RETRIBUTION,
    ]
  },
  {
    template: 34,
    unitTribe: battle.UNIT_TRIBE_ASSEMBLING,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_WEAKNESS,
      battle.ABILITY_WIND_WALK,
    ]
  },
  // battle.UNIT_TRIBE_CLOCKWORK
  {
    template: 35,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_STUN,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 36,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FURY_CLAWS,
      battle.ABILITY_BLADE_VORTEX,
    ]
  },
  {
    template: 37,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 38,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 39,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_CURSE,
      battle.ABILITY_MIGHT,
      battle.ABILITY_HEAL,
    ]
  },
  // battle.UNIT_TRIBE_SKELETON
  {
    template: 40,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_ARROW_CRUSH,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 41,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 42,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_DRAGON_BITE,
      battle.ABILITY_FLIGHT,
      battle.ABILITY_DRAGON_FURY,
    ]
  },
  {
    template: 43,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_HEAVY_STRIKE,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 44,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_WEAKNESS,
      battle.ABILITY_LAZINESS,
    ]
  },
    // battle.UNIT_TRIBE_CLOCKWORK
  {
    template: 45,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_STUN,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 46,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FURY_CLAWS,
      battle.ABILITY_BLADE_VORTEX,
    ]
  },
  {
    template: 47,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 48,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 49,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_CURSE,
      battle.ABILITY_MIGHT,
      battle.ABILITY_HEAL,
    ]
  },
  // battle.UNIT_TRIBE_ICE
  {
    template: 50,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RAGE,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 51,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FROST_BLADE,
      battle.ABILITY_FROZEN_ABYSS,
    ]
  },
  {
    template: 52,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_SPEAR_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_FATAL_STRIKE,
    ]
  },
  {
    template: 53,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_TELEPORTATION,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 54,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_MIGHT,
      battle.ABILITY_LAZINESS,
    ]
  },
  // battle.UNIT_TRIBE_ELF
  {
    template: 55,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_DOUBLE_SHOT,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 56,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 57,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 58,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_RUSH,
      battle.ABILITY_RETRIBUTION,
    ]
  },
  {
    template: 59,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_MIGHT,
      battle.ABILITY_HEAL,
    ]
  },
  // battle.UNIT_TRIBE_ELDRITCH
  {
    template: 60,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_DOUBLE_SHOT,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 61,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_STRONG_PUNCH,
      battle.ABILITY_FURY_CLAWS,
      battle.ABILITY_BLADE_VORTEX,
    ]
  },
  {
    template: 62,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_STUN,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 63,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_TELEPORTATION,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 64,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_WEAKNESS,
      battle.ABILITY_LAZINESS,
    ]
  },
  // battle.UNIT_TRIBE_FALLEN_KING
  {
    template: 65,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 66,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_ZEALOT,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 67,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 68,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_HEAVY_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_HUMMER_BLOW,
    ]
  },
  {
    template: 69,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_WEAKNESS,
      battle.ABILITY_WIND_WALK,
    ]
  },
  // battle.UNIT_TRIBE_LEGENDARY
  {
    template: 70,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_MAGE,
    abilityList: [
      battle.ABILITY_FLAME_STRIKE,
      battle.ABILITY_HURRICANE,
      battle.ABILITY_DARK_VORTEX,
    ]
  },
  {
    template: 71,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 72,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_KUNAI_STRIKE,
      battle.ABILITY_BLADE_VORTEX,
    ]
  },
  {
    template: 73,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 74,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_MIGHT,
      battle.ABILITY_LAZINESS,
    ]
  },
  // battle.UNIT_TRIBE_TITAN
  {
    template: 75,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilityList: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 76,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FIRE_BLADE,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 77,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilityList: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FROST_BLADE,
      battle.ABILITY_FROZEN_ABYSS,
    ]
  },
  {
    template: 78,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_TANK,
    abilityList: [
      battle.ABILITY_HOLY_STRIKE,
      battle.ABILITY_FLIGHT,
      battle.ABILITY_RETRIBUTION,
    ]
  },
  {
    template: 79,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilityList: [
      battle.ABILITY_HEAL,
      battle.ABILITY_MIGHT,
      battle.ABILITY_WIND_WALK,
    ]
  },
];

export const SQUAD_BONUSES = {
  [battle.UNIT_TRIBE_KOBOLD]: [
    // Tier 1
    [
      // Attack +5%
      { type: "attack", mode: "constant", modifier: 1.5 },
      { type: "attack", mode: "constant", modifier: 1.7 },
      { type: "attack", mode: "constant", modifier: 1.10 },
      { type: "attack", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Swamp speed
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-1" },
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-2" },
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-3" },
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by +1 (max. 3)      
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 3 },
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 4 },
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 5 },
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 6 },
    ],
  ],
  [battle.UNIT_TRIBE_DWARF]: [
    // Tier 1
    [
      // Attack +5%
      { type: "hp", mode: "constant", modifier: 1.05 },
      { type: "hp", mode: "constant", modifier: 1.07 },
      { type: "hp", mode: "constant", modifier: 1.1 },
      { type: "hp", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-1" },
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-2" },
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-3" },
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by +1 (max. 3)
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 3 },
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 4 },
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 5 },
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 6 },
    ],
  ],
  [battle.UNIT_TRIBE_EGYPTIAN]: [
    // Tier 1
    [
      // Attack +5%
      { type: "attack", mode: "constant", modifier: 1.05 },
      { type: "attack", mode: "constant", modifier: 1.07 },
      { type: "attack", mode: "constant", modifier: 1.1 },
      { type: "attack", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-1" },
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-2" },
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-3" },
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-4" },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { type: "counter_attack", mode: "burst", probability: 0.07 },
      { type: "counter_attack", mode: "burst", probability: 0.10 },
      { type: "counter_attack", mode: "burst", probability: 0.12 },
      { type: "counter_attack", mode: "burst", probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_GOBLIN]: [
    // Tier 1
    [
      // HP +5%
      { type: "hp", mode: "constant", modifier: 1.05 },
      { type: "hp", mode: "constant", modifier: 1.07 },
      { type: "hp", mode: "constant", modifier: 1.10 },
      { type: "hp", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-1" },
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-2" },
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-3" },
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-4" },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by +1      
      { type: "speed", mode: "constant", trigger: "debuff", delta: 1 },
      { type: "speed", mode: "constant", trigger: "debuff", delta: 2 },
      { type: "speed", mode: "constant", trigger: "debuff", delta: 3 },
      { type: "speed", mode: "constant", trigger: "debuff", delta: 4 },
    ],
  ],
  [battle.UNIT_TRIBE_INSECT]: [
    // Tier 1
    [
      // Defense +5%
      { type: "defence", mode: "constant", modifier: 1.05 },
      { type: "defence", mode: "constant", modifier: 1.07 },
      { type: "defence", mode: "constant", modifier: 1.10 },
      { type: "defence", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Swamp slows down by 25% less
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-1" },
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-2" },
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-3" },
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by +1 (max. 3)      
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 3 },
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 4 },
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 5 },
      { type: "defence", mode: "stack", trigger: "damage", delta: 1, max: 6 },
    ],
  ],
  [battle.UNIT_TRIBE_ORC]: [
    // Tier 1
    [
      // Attack +5%
      { type: "attack", mode: "constant", modifier: 1.05 },
      { type: "attack", mode: "constant", modifier: 1.07 },
      { type: "attack", mode: "constant", modifier: 1.10 },
      { type: "attack", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-1" },
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-2" },
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-3" },
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's attack is increased by 2,5% (max. 15%)      
      { type: "attack", mode: "constant", delta: 2.5, percents: true, max: 15 },
      { type: "attack", mode: "constant", delta: 2.5, percents: true, max: 20 },
      { type: "attack", mode: "constant", delta: 3,   percents: true, max: 25 },
      { type: "attack", mode: "constant", delta: 3,   percents: true, max: 30 },
    ],
  ],
  [battle.UNIT_TRIBE_ASSEMBLING]: [
    // Tier 1
    [
      // Abilities power +5%
      { type: "abilities", mode: "constant", modifier: 1.05 },
      { type: "abilities", mode: "constant", modifier: 1.07 },
      { type: "abilities", mode: "constant", modifier: 1.10 },
      { type: "abilities", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Swamp speed
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-1" },
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-2" },
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-3" },
      { type: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-4" },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { type: "power", mode: "burst", modifier: 1.3, probability: 0.07 },
      { type: "power", mode: "burst", modifier: 1.5, probability: 0.10 },
      { type: "power", mode: "burst", modifier: 1.7, probability: 0.12 },
      { type: "power", mode: "burst", modifier: 2, probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_ICE]: [
    // Tier 1
    [
      // Defense +5%
      { type: "defence", mode: "constant", modifier: 1.05 },
      { type: "defence", mode: "constant", modifier: 1.07 },
      { type: "defence", mode: "constant", modifier: 1.10 },
      { type: "defence", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Defense on ice
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-1" },
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-2" },
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-3" },
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-4" },
    ],
    // Tier 3
    [
      //When a unit is debuffed, their speed is increased by +1      
      { type: "speed", mode: "constant", trigger: "debuff", delta: 1 },
      { type: "speed", mode: "constant", trigger: "debuff", delta: 2 },
      { type: "speed", mode: "constant", trigger: "debuff", delta: 3 },
      { type: "speed", mode: "constant", trigger: "debuff", delta: 4 },
    ],
  ],
  [battle.UNIT_TRIBE_CLOCKWORK]: [
    // Tier 1
    [
      // Defense +5%
      { type: "defence", mode: "constant", modifier: 1.05 },
      { type: "defence", mode: "constant", modifier: 1.07 },
      { type: "defence", mode: "constant", modifier: 1.10 },
      { type: "defence", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Lava deals 25% less damage
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-1" },
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-2" },
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-3" },
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { type: "power", mode: "stack", modifier: 2.5, trigger: "damage", percents: true, max: 15 },
      { type: "power", mode: "stack", modifier: 2.5, trigger: "damage", percents: true, max: 20 },
      { type: "power", mode: "stack", modifier: 3, trigger: "damage", percents: true, max: 25 },
      { type: "power", mode: "stack", modifier: 3, trigger: "damage", percents: true, max: 30 },
    ],
  ],
  [battle.UNIT_TRIBE_ELDRITCH]: [
    // Tier 1
    [
      // Defense +5%
      { type: "hp", mode: "constant", modifier: 1.05 },
      { type: "hp", mode: "constant", modifier: 1.07 },
      { type: "hp", mode: "constant", modifier: 1.10 },
      { type: "hp", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-1" },
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-2" },
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-3" },
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-4" },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { type: "power", mode: "burst", modifier: 1.3, probability: 0.07 },
      { type: "power", mode: "burst", modifier: 1.5, probability: 0.10 },
      { type: "power", mode: "burst", modifier: 1.7, probability: 0.12 },
      { type: "power", mode: "burst", modifier: 2, probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_ELF]: [
    // Tier 1
    [
      // Abilities power +5%
      { type: "abilities", mode: "constant", modifier: 1.05 },
      { type: "abilities", mode: "constant", modifier: 1.07 },
      { type: "abilities", mode: "constant", modifier: 1.10 },
      { type: "abilities", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-1" },
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-2" },
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-3" },
      { type: "defence", mode: "constant", terrain: "woods", scheme: "woods-4" },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { type: "counter_attack", mode: "burst", probability: 0.07 },
      { type: "counter_attack", mode: "burst", probability: 0.10 },
      { type: "counter_attack", mode: "burst", probability: 0.12 },
      { type: "counter_attack", mode: "burst", probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_SKELETON]: [
    // Tier 1
    [
      // Abilities power +5%
      { type: "hp", mode: "constant", modifier: 1.05 },
      { type: "hp", mode: "constant", modifier: 1.07 },
      { type: "hp", mode: "constant", modifier: 1.10 },
      { type: "hp", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Defense on ice
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-1" },
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-2" },
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-3" },
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { type: "power", mode: "stack", modifier: 2.5, trigger: "damage", percents: true, max: 15 },
      { type: "power", mode: "stack", modifier: 2.5, trigger: "damage", percents: true, max: 20 },
      { type: "power", mode: "stack", modifier: 3, trigger: "damage", percents: true, max: 25 },
      { type: "power", mode: "stack", modifier: 3, trigger: "damage", percents: true, max: 30 },
    ],
  ],
  [battle.UNIT_TRIBE_FALLEN_KING]: [
    // Tier 1
    [
      // Attack +5%
      { type: "attack", mode: "constant", modifier: 1.05 },
      { type: "attack", mode: "constant", modifier: 1.07 },
      { type: "attack", mode: "constant", modifier: 1.10 },
      { type: "attack", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-1" },
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-2" },
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-3" },
      { type: "power", mode: "constant", terrain: "hill", scheme: "hill-4" },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { type: "power", mode: "burst", modifier: 1.3, probability: 0.07 },
      { type: "power", mode: "burst", modifier: 1.5, probability: 0.10 },
      { type: "power", mode: "burst", modifier: 1.7, probability: 0.12 },
      { type: "power", mode: "burst", modifier: 2, probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_LEGENDARY]: [
    // Tier 1
    [
      // Attack +5%
      { type: "attack", mode: "constant", modifier: 1.05 },
      { type: "attack", mode: "constant", modifier: 1.07 },
      { type: "attack", mode: "constant", modifier: 1.10 },
      { type: "attack", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Defence on ice
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-1" },
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-2" },
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-3" },
      { type: "defence", mode: "constant", terrain: "ice", scheme: "ice-4" },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { type: "counter_attack", mode: "burst", probability: 0.07 },
      { type: "counter_attack", mode: "burst", probability: 0.10 },
      { type: "counter_attack", mode: "burst", probability: 0.12 },
      { type: "counter_attack", mode: "burst", probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_TITAN]: [
    // Tier 1
    [
      // Abilities power +5%
      { type: "abilities", mode: "constant", modifier: 1.05 },
      { type: "abilities", mode: "constant", modifier: 1.07 },
      { type: "abilities", mode: "constant", modifier: 1.10 },
      { type: "abilities", mode: "constant", modifier: 1.15 },
    ],
    // Tier 2
    [
      // Defense on ice
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-1" },
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-2" },
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-3" },
      { type: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-4" },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by +1
      { type: "speed", mode: "constant", trigger: "debuff", modifier: 1 },
      { type: "speed", mode: "constant", trigger: "debuff", modifier: 2 },
      { type: "speed", mode: "constant", trigger: "debuff", modifier: 3 },
      { type: "speed", mode: "constant", trigger: "debuff", modifier: 4 },
    ],
  ],
};

export const ABILITY_LEVEL_UP_PRICES = [
  // Tier 1
  [
    0,
    3,
    5,
    7,
    9,
    11,
    13,
    15,
    17,
    19,
    21,
    23,
    25,
    27,
    29
  ],
  // Tier 2
  [
    0,
    15,
    17,
    19,
    21,
    23,
    25,
    27
  ],
  // Tier 3
  [
    0,
    30,
    35
  ],
];

export const UNIT_LEVEL_UP_PRICES = [
  0,
  150,
  150,
  150,
  150, // lvl 5
  450,
  450,
  450,
  450,
  450, // lvl 10
  800,
  800,
  800,
  800,
  800, // lvl 15
  1100,
  1100,
  1100,
  1100,
  1100, // lvl 20
  1300,
  1300,
  1300,
  1300,
  1300, // lvl 25
  1500,
  1500,
  1500,
  1500,
  1500, // lvl 30
  2100,
  2100,
  2100,
  2100,
  2100, // lvl 35
  2300,
  2300,
  2300,
  2300,
  2300, // lvl 40
  2500,
  2500,
  2500,
  2500,
  2500, // lvl 45
];

export const TERRAIN = [
  {
    base: "grass",
    tiles: [
        null,
        null, null,
        null, null,
        null, "grass_woods", null, "grass_woods", null,
        null, null,
        null, null,
        null, null, "grass_woods", null, "grass_woods", null,
        null, null,
        null, null, null],
  }, 
  {
    base: "grass",
    tiles: [
        null, "grass_woods", null,
        null, null,
        null, null,
        null, null, "grass_woods", "grass_woods", "grass_woods", null,
        null, null,
        null, null,
        null, null,
        null, "grass_woods", null,
        null, "grass_woods", null],
  }, 
  {
    base: "grass",
    tiles: [
        null, "grass_woods", null,
        null, "grass_woods", null,
        null, null,
        null, null, "grass_woods", "grass_woods", null, "grass_woods", "grass_woods", null,
        null, null,
        null, null,
        null, "grass_woods", null, "grass_woods", null],
  }, 
  {
    base: "grass",
    tiles: [
        null, "grass_woods", null,
        null, null,
        null, "grass_hill", null, "grass_woods", "grass_woods", "grass_woods", "grass_woods", null, "grass_hill", null,
        null, "grass_hill", null, "grass_woods", "grass_woods", null, "grass_woods", null,
        null, null],
  }, 
  {
    base: "grass",
    tiles: ["grass_woods", "grass_woods", null,
        null, null, "grass_woods", "grass_hill", null, "grass_woods", "grass_woods", null,
        null, "grass_hill", null,
        null, "grass_woods", "grass_woods", null, "grass_hill", "grass_woods", null,
        null, null, "grass_woods", "grass_woods"],
  }, 
  {
    base: "grass",
    tiles: [
        null,
        null, null, "grass_woods", "grass_woods", "grass_swamp_c", "grass_woods", "grass_woods", null, "grass_hill", "grass_swamp_b", "grass_woods", null,
        null, null,
        null, null, "grass_hill", "grass_woods", "grass_swamp", null,
        null, "grass_woods", "grass_woods", null],
  }, 
  {
    base: "grass",
    tiles: [
        null,
        null, null,
        null, null, "grass_woods", "grass_woods", "grass_swamp", "grass_hill", "grass_swamp", "grass_swamp_c", "grass_woods", "grass_hill", "grass_woods", null, "grass_swamp_b", "grass_hill", "grass_woods", "grass_woods", "grass_swamp", null,
        null, null,
        null, null],
  }, 
  {
    base: "grass",
    tiles: [
        null, "grass_woods", "grass_swamp", "grass_hill", "grass_swamp_a", "grass_woods", "grass_hill", "grass_woods", "grass_woods", "grass_swamp_d", "grass_hill", "grass_swamp_a", "grass_swamp_b", "grass_woods", "grass_hill", "grass_woods", "grass_swamp_d", "grass_swamp_c", "grass_hill", "grass_swamp_a", "grass_woods", "grass_woods", "grass_woods", "grass_woods", "grass_swamp_d"],
  }, 
  {
    base: "grass",
    tiles: ["grass_hill", "grass_swamp_a", null, "grass_swamp_a", "grass_swamp_b", "grass_woods", "grass_swamp_d", "grass_woods", "grass_swamp_d", "grass_swamp_c", "grass_hill", null, "grass_woods", "grass_woods", null, "grass_swamp_a", "grass_swamp_b", "grass_hill", "grass_swamp_a", "grass_hill", "grass_swamp_d", "grass_swamp_c", null, "grass_swamp_d", "grass_woods"],
  }, 
  {
    base: "grass",
    tiles: ["grass_swamp", "grass_woods", "grass_swamp1", "grass_swamp2", "grass_woods", "grass_hill", "grass_woods", "grass_woods", "grass_hill", "grass_woods", "grass_swamp_x", "grass_swamp_y", "grass_swamp_y", "grass_swamp_y", "grass_swamp_z", "grass_hill", "grass_woods", "grass_woods", "grass_hill", "grass_woods", "grass_woods", "grass_swamp", "grass_woods", "grass_swamp", "grass_woods"],
  }, 

  {
    base: "sand",
    tiles: [
        null,
        null, null,
        null, null, "sand_thorns", null, "sand_thorns", null, "sand_thorns", null,
        null, null,
        null, null,
        null, "sand_thorns", null, "sand_thorns", null,
        null, null,
        null, null, null],
  }, 
  {
    base: "sand",
    tiles: [
        null,
        null, null,
        null, null,
        null, null,
        null, "sand_hill", "sand_thorns", "sand_thorns", "sand_thorns", null, "sand_thorns", "sand_thorns", "sand_thorns", "sand_hill", null,
        null, null,
        null, null,
        null, null, null],
  }, 
  {
    base: "sand",
    tiles: [
        null,
        null, null,
        null, null,
        null, "sand_thorns", "sand_hill", "sand_thorns", null,
        null, "sand_thorns", null, "sand_thorns", null,
        null, "sand_thorns", "sand_hill", "sand_thorns", null,
        null, null,
        null, null, null],
  }, 
  {
    base: "sand",
    tiles: [
        null,
        null, null,
        null, null,
        null, "sand_thorns", "sand_thorns", "sand_thorns", null,
        null, null, "sand_hill", null,
        null, null, "sand_thorns", "sand_thorns", "sand_thorns", null,
        null, null,
        null, null, null],
  }, 
  {
    base: "sand",
    tiles: ["sand_thorns", null,
        null, null,
        null, null,
        null, "sand_thorns", "sand_hill", null,
        null, "sand_thorns", "sand_thorns", "sand_thorns", null,
        null, "sand_hill", "sand_thorns", null,
        null, null,
        null, null,
        null, "sand_thorns"],
  }, 
  {
    base: "sand",
    tiles: [
        null,
        null, null,
        null, null,
        null, "sand_thorns", "sand_lava", "sand_thorns", "sand_lava", null,
        null, "sand_hill", null,
        null, "sand_lava", "sand_thorns", "sand_lava", "sand_thorns", null,
        null, null,
        null, null, null],
  }, 
  {
    base: "sand",
    tiles: [
        null,
        null, "sand_thorns", null,
        null, null, "sand_hill", "sand_hill", null,
        null, "sand_thorns", null, "sand_lava1", "sand_lava2", "sand_thorns", null,
        null, null, "sand_hill", "sand_hill", null,
        null, null, "sand_thorns", null],
  }, 
  {
    base: "sand",
    tiles: [
        null,
        null, null,
        null, null, "sand_thorns", "sand_hill", "sand_thorns", "sand_hill", "sand_hill", "sand_lava1", "sand_lava2", "sand_thorns", "sand_lava1", "sand_lava2", "sand_hill", "sand_hill", "sand_thorns", "sand_hill", "sand_thorns", null,
        null, null,
        null, null],
  }, 
  {
    base: "sand",
    tiles: ["sand_lava1", "sand_lava2", "sand_hill", "sand_hill", "sand_thorns", null,
        null, "sand_thorns", "sand_lava_a", "sand_lava_b", "sand_lava_a", "sand_lava_b", "sand_hill", "sand_lava_d", "sand_lava_c", "sand_lava_d", "sand_lava_c", "sand_thorns", null,
        null, "sand_thorns", "sand_hill", "sand_hill", "sand_lava1", "sand_lava2"],
  }, 
  {
    base: "sand",
    tiles: ["sand_hill", "sand_thorns", null, "sand_thorns", "sand_hill", "sand_lava_a", "sand_lava_b", null, "sand_hill", "sand_hill", "sand_lava_d", "sand_lava_c", "sand_thorns", "sand_lava_a", "sand_lava_b", "sand_hill", "sand_hill", null, "sand_lava_d", "sand_lava_c", "sand_hill", "sand_thorns", null, "sand_thorns", "sand_hill"],
  }, 

  {
    base: "snow",
    tiles: [
        null,
        null, null,
        null, null,
        null, "snow_hill", null, "snow_hill", null, "snow_woods", null, "snow_woods", null, "snow_woods", null, "snow_hill", null, "snow_hill", null,
        null, null,
        null, null, null],
  }, 
  {
    base: "snow",
    tiles: [
        null,
        null, null,
        null, null, "snow_woods", null, "snow_woods", null, "snow_woods", null, "snow_hill", null, "snow_hill", null, "snow_woods", null, "snow_woods", null, "snow_woods", null,
        null, null,
        null, null],
  }, 
  {
    base: "snow",
    tiles: [
        null,
        null, null,
        null, null,
        null, "snow_hill", "snow_woods", "snow_hill", null,
        null, "snow_woods", null, "snow_woods", null,
        null, "snow_hill", "snow_woods", "snow_hill", null,
        null, null,
        null, null, null],
  }, 
  {
    base: "snow",
    tiles: [
        null,
        null, null,
        null, null, "snow_woods", null, "snow_woods", null, "snow_woods", "snow_hill", "snow_woods", "snow_hill", "snow_woods", "snow_hill", "snow_woods", null, "snow_woods", null, "snow_woods", null,
        null, null,
        null, null],
  }, 
  {
    base: "snow",
    tiles: [
        null,
        null, null,
        null, null, "snow_hill", "snow_hill", "snow_ice", "snow_woods", "snow_woods", "snow_ice", "snow_woods", "snow_woods", "snow_ice", null, "snow_hill", "snow_hill", "snow_ice", "snow_hill", "snow_woods", null,
        null, null,
        null, null],
  }, 
  {
    base: "snow",
    tiles: [
        null,
        null, null,
        null, null, "snow_woods", "snow_woods", "snow_hill", "snow_woods", "snow_woods", null, "snow_ice", "snow_woods", "snow_ice", null, "snow_woods", "snow_woods", "snow_hill", "snow_woods", "snow_woods", null,
        null, null,
        null, null],
  }, 
  {
    base: "snow",
    tiles: ["snow_hill", "snow_hill", null,
        null, null, "snow_woods", "snow_woods", null, "snow_ice_1", null,
        null, "snow_ice_1", "snow_hill", "snow_ice_1-1", null,
        null, "snow_ice_1-1", null, "snow_woods", "snow_woods", null,
        null, null, "snow_hill", "snow_hill"],
  }, 
  {
    base: "snow",
    tiles: ["snow_woods", "snow_woods", "snow_ice_1", "snow_woods", "snow_woods", "snow_hill", "snow_hill", "snow_ice_1-1", null,
        null, "snow_woods", "snow_woods", null, "snow_woods", "snow_woods", null,
        null, "snow_ice_1", "snow_hill", "snow_hill", "snow_woods", "snow_woods", "snow_ice_1-1", "snow_woods", "snow_woods"],
  }, 
  {
    base: "snow",
    tiles: ["snow_hill", "snow_hill", "snow_woods", "snow_ice_a", "snow_ice_b", "snow_woods", "snow_hill", "snow_woods", "snow_ice_d", "snow_ice_c", "snow_woods", null,
        null, null, "snow_woods", "snow_ice_a", "snow_ice_b", "snow_woods", "snow_hill", "snow_woods", "snow_ice_d", "snow_ice_c", "snow_woods", "snow_hill", "snow_hill"],
  }, 
  {
    base: "snow",
    tiles: ["snow_ice_a", "snow_ice_b", "snow_woods", "snow_ice_1", "snow_ice_1-1", "snow_ice_d", "snow_ice_c", "snow_woods", "snow_hill", "snow_woods", "snow_hill", "snow_hill", "snow_ice", "snow_woods", "snow_woods", "snow_hill", "snow_woods", "snow_hill", "snow_ice_a", "snow_ice_b", "snow_ice_1", "snow_ice_1-1", "snow_hill", "snow_ice_d", "snow_ice_c"],
  }, 
];

export const ABILITY_SCHEME = [
  [{cd: 5, lvl: 1}, null, null], // unit lvl 1
  [{cd: 5, lvl: 1}, null, null],
  [{cd: 5, lvl: 1}, null, null],
  [{cd: 5, lvl: 2}, null, null], // unit lvl 4
  [{cd: 5, lvl: 2}, null, null], 
  [{cd: 5, lvl: 2}, null, null], 
  [{cd: 5, lvl: 3}, null, null], // unit lvl 7
  [{cd: 5, lvl: 3}, null, null],
  [{cd: 5, lvl: 3}, null, null],
  [{cd: 5, lvl: 4}, null, null], // unit lvl 10
  [{cd: 5, lvl: 4}, null, null], 
  [{cd: 5, lvl: 4}, null, null], 
  [{cd: 5, lvl: 5}, null, null], // unit lvl 13
  [{cd: 5, lvl: 5}, null, null],
  [{cd: 5, lvl: 5}, null, null],
  
  [{cd: 4, lvl: 6}, {cd: 5, lvl: 1}, null], // unit lvl 16
  [{cd: 4, lvl: 6}, {cd: 5, lvl: 1}, null],
  [{cd: 4, lvl: 6}, {cd: 5, lvl: 1}, null],
  [{cd: 4, lvl: 7}, {cd: 5, lvl: 1}, null], // unit lvl 19
  [{cd: 4, lvl: 7}, {cd: 5, lvl: 2}, null], // unit lvl 20
  [{cd: 4, lvl: 7}, {cd: 5, lvl: 2}, null],
  [{cd: 4, lvl: 8}, {cd: 5, lvl: 2}, null], // unit lvl 22
  [{cd: 4, lvl: 8}, {cd: 5, lvl: 2}, null],
  [{cd: 4, lvl: 8}, {cd: 5, lvl: 3}, null], // unit lvl 24
  [{cd: 4, lvl: 9}, {cd: 5, lvl: 3}, null], // unit lvl 25
  [{cd: 4, lvl: 9}, {cd: 5, lvl: 3}, null],
  [{cd: 4, lvl: 9}, {cd: 5, lvl: 3}, null],
  [{cd: 4, lvl: 10}, {cd: 5, lvl: 4}, null], // unit lvl 28
  [{cd: 4, lvl: 10}, {cd: 5, lvl: 4}, null],
  [{cd: 4, lvl: 10}, {cd: 5, lvl: 4}, null],

  [{cd: 3, lvl: 11}, {cd: 4, lvl: 4}, {cd: 5, lvl: 1}], // unit lvl 31
  [{cd: 3, lvl: 11}, {cd: 4, lvl: 5}, {cd: 5, lvl: 1}],
  [{cd: 3, lvl: 11}, {cd: 4, lvl: 5}, {cd: 5, lvl: 1}],
  [{cd: 3, lvl: 12}, {cd: 4, lvl: 5}, {cd: 5, lvl: 1}], // unit lvl 34
  [{cd: 3, lvl: 12}, {cd: 4, lvl: 5}, {cd: 5, lvl: 1}], // unit lvl 35
  [{cd: 3, lvl: 12}, {cd: 4, lvl: 6}, {cd: 5, lvl: 1}], // unit lvl 36
  [{cd: 3, lvl: 13}, {cd: 4, lvl: 6}, {cd: 5, lvl: 1}], // unit lvl 37
  [{cd: 3, lvl: 13}, {cd: 4, lvl: 6}, {cd: 4, lvl: 2}],
  [{cd: 3, lvl: 13}, {cd: 4, lvl: 6}, {cd: 4, lvl: 2}], // unit lvl 39
  [{cd: 3, lvl: 14}, {cd: 3, lvl: 7}, {cd: 4, lvl: 2}], // unit lvl 40
  [{cd: 3, lvl: 14}, {cd: 3, lvl: 7}, {cd: 4, lvl: 2}],
  [{cd: 3, lvl: 14}, {cd: 3, lvl: 7}, {cd: 4, lvl: 2}], // unit lvl 42
  [{cd: 3, lvl: 15}, {cd: 3, lvl: 7}, {cd: 4, lvl: 2}], // unit lvl 43
  [{cd: 3, lvl: 15}, {cd: 3, lvl: 8}, {cd: 4, lvl: 2}],
  [{cd: 3, lvl: 15}, {cd: 3, lvl: 8}, {cd: 3, lvl: 3}],
];