import * as battle from "./../../knightlands-shared/battle";

export const PATH_SCHEME_ROOK = "rook";
export const PATH_SCHEME_QUEEN = "queen";

export const SETTINGS = {
  maxExp: 99000,
  moveScheme: PATH_SCHEME_ROOK,
  maxUnitTierLevel: {
    1: 15,
    2: 30,
    3: 45
  },
  terrain: {
    [battle.TERRAIN_ICE]: {
      target: "damage",
      modifiers: {
        "ice-0": 1.25,
        "ice-1": 1.187,
        "ice-2": 1.12,
        "ice-3": 1.0625,
        "ice-4": 1
      }
    },
    [battle.TERRAIN_HILL]:  {
      target: "power",
      modifiers: {
        "hill-0": 1.25,
        "hill-1": 1.3125,
        "hill-2": 1.375,
        "hill-3": 1.4375,
        "hill-4": 1.5
      }
    },
    [battle.TERRAIN_WOODS]: {
      target: "defence",
      modifiers: {
        "woods-0": 1.25,
        "woods-1": 1.3125,
        "woods-2": 1.375,
        "woods-3": 1.4375,
        "woods-4": 1.5
      }
    },
    [battle.TERRAIN_SWAMP]: {
      target: "speed",
      modifiers: {
        "swamp-0": 0.5,
        "swamp-1": 0.375,
        "swamp-2": 0.25,
        "swamp-3": 0.125,
        "swamp-4": 0
      }
    },
    [battle.TERRAIN_LAVA]:  {
      target: "damage",
      modifiers: {
        "lava-0": 0.05,
        "lava-1": 0.0375,
        "lava-2": 0.025,
        "lava-3": 0.0125,
        "lava-4": 0
      }
    },
  } as {
    [terrain: string]: {
      target: "no" | "damage" | "defence" | "speed" | "initiative" | "hp" | "attack" | "power" | "abilities";
      modifiers: {
        [lvl: string]: number
      }
    }
  }
};

export const AVG_HP = 70.7;
export const AVG_DMG = 7.1;

export const BUFF_SOURCE_SQUAD = 'squad';
export const BUFF_SOURCE_TERRAIN = 'terrain';
export const BUFF_SOURCE_BUFF = 'buff';
export const BUFF_SOURCE_SELF_BUFF = 'self_buff';
export const BUFF_SOURCE_DE_BUFF = 'de_buff';

export const SQUAD_BONUSES = {
  [battle.UNIT_TRIBE_KOBOLD]: [
    // Tier 1
    [
      // Attack +5%
      { target: "attack", mode: "constant", operation: "multiply", value: 1.5 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.7 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Swamp speed
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-1" },
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-2" },
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-3" },
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by +1 (max. 3)
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 3 },
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 4 },
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 5 },
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 6 },
    ],
  ],
  [battle.UNIT_TRIBE_DWARF]: [
    // Tier 1
    [
      // Attack +5%
      { target: "hp", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.1 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-1" },
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-2" },
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-3" },
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by +1 (max. 3)
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 3 },
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 4 },
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 5 },
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 6 },
    ],
  ],
  [battle.UNIT_TRIBE_EGYPTIAN]: [
    // Tier 1
    [
      // Attack +5%
      { target: "attack", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.1 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-1" },
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-2" },
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-3" },
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-4" },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { subEffect: "counter_attack", mode: "burst", probability: 0.07 },
      { subEffect: "counter_attack", mode: "burst", probability: 0.10 },
      { subEffect: "counter_attack", mode: "burst", probability: 0.12 },
      { subEffect: "counter_attack", mode: "burst", probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_GOBLIN]: [
    // Tier 1
    [
      // HP +5%
      { target: "hp", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-1" },
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-2" },
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-3" },
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-4" },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by +1
      { target: "speed", mode: "constant", trigger: "debuff", operation: "add", value: 1 },
      { target: "speed", mode: "constant", trigger: "debuff", operation: "add", value: 2 },
      { target: "speed", mode: "constant", trigger: "debuff", operation: "add", value: 3 },
      { target: "speed", mode: "constant", trigger: "debuff", operation: "add", value: 4 },
    ],
  ],
  [battle.UNIT_TRIBE_INSECT]: [
    // Tier 1
    [
      // Defense +5%
      { target: "defence", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "defence", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "defence", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "defence", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Swamp slows down by 25% less
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-1" },
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-2" },
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-3" },
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by +1 (max. 3)
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 3 },
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 4 },
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 5 },
      { target: "defence", mode: "stack", trigger: "damage", operation: "add", value: 1, max: 6 },
    ],
  ],
  [battle.UNIT_TRIBE_ORC]: [
    // Tier 1
    [
      // Attack +5%
      { target: "attack", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-1" },
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-2" },
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-3" },
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's attack is increased by 2,5% (max. 15%)
      { target: "attack", mode: "stack", delta: 0.025, trigger: "damage", multiply: true, max: 0.15 },
      { target: "attack", mode: "stack", delta: 0.025, trigger: "damage", multiply: true, max: 0.20 },
      { target: "attack", mode: "stack", delta: 0.03,  trigger: "damage", multiply: true, max: 0.25 },
      { target: "attack", mode: "stack", delta: 0.03,  trigger: "damage", multiply: true, max: 0.30 },
    ],
  ],
  [battle.UNIT_TRIBE_ASSEMBLING]: [
    // Tier 1
    [
      // Abilities power +5%
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Swamp speed
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-1" },
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-2" },
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-3" },
      { target: "speed", mode: "constant", terrain: "swamp", scheme: "swamp-4" },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { target: "power", mode: "burst", operation: "multiply", value: 1.3, probability: 0.07 },
      { target: "power", mode: "burst", operation: "multiply", value: 1.5, probability: 0.10 },
      { target: "power", mode: "burst", operation: "multiply", value: 1.7, probability: 0.12 },
      { target: "power", mode: "burst", operation: "multiply", value: 2, probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_ICE]: [
    // Tier 1
    [
      // Defense +5%
      { target: "defence", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "defence", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "defence", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "defence", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Defense on ice
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-1" },
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-2" },
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-3" },
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-4" },
    ],
    // Tier 3
    [
      //When a unit is debuffed, their speed is increased by +1
      { target: "speed", mode: "constant", trigger: "debuff", delta: 1 },
      { target: "speed", mode: "constant", trigger: "debuff", delta: 2 },
      { target: "speed", mode: "constant", trigger: "debuff", delta: 3 },
      { target: "speed", mode: "constant", trigger: "debuff", delta: 4 },
    ],
  ],
  [battle.UNIT_TRIBE_CLOCKWORK]: [
    // Tier 1
    [
      // Defense +5%
      { target: "defence", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "defence", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "defence", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "defence", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Lava deals 25% less damage
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-1" },
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-2" },
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-3" },
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { target: "power", mode: "stack", delta: 0.025, trigger: "damage", multiply: true, max: 0.15 },
      { target: "power", mode: "stack", delta: 0.025, trigger: "damage", multiply: true, max: 0.20 },
      { target: "power", mode: "stack", delta: 0.03,  trigger: "damage", multiply: true, max: 0.25 },
      { target: "power", mode: "stack", delta: 0.03,  trigger: "damage", multiply: true, max: 0.30 },
    ],
  ],
  [battle.UNIT_TRIBE_ELDRITCH]: [
    // Tier 1
    [
      // Defense +5%
      { target: "hp", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-1" },
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-2" },
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-3" },
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-4" },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { target: "power", mode: "burst", operation: "multiply", value: 1.3, probability: 0.07 },
      { target: "power", mode: "burst", operation: "multiply", value: 1.5, probability: 0.10 },
      { target: "power", mode: "burst", operation: "multiply", value: 1.7, probability: 0.12 },
      { target: "power", mode: "burst", operation: "multiply", value: 2, probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_ELF]: [
    // Tier 1
    [
      // Abilities power +5%
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-1" },
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-2" },
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-3" },
      { target: "defence", mode: "constant", terrain: "woods", scheme: "woods-4" },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { subEffect: "counter_attack", mode: "burst", probability: 0.07 },
      { subEffect: "counter_attack", mode: "burst", probability: 0.10 },
      { subEffect: "counter_attack", mode: "burst", probability: 0.12 },
      { subEffect: "counter_attack", mode: "burst", probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_SKELETON]: [
    // Tier 1
    [
      // Abilities power +5%
      { target: "hp", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "hp", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Defense on ice
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-1" },
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-2" },
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-3" },
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-4" },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { target: "power", mode: "stack", delta: 0.025, trigger: "damage", multiply: true, max: 0.15 },
      { target: "power", mode: "stack", delta: 0.025, trigger: "damage", multiply: true, max: 0.20 },
      { target: "power", mode: "stack", delta: 0.03, trigger: "damage", multiply: true, max: 0.25 },
      { target: "power", mode: "stack", delta: 0.03, trigger: "damage", multiply: true, max: 0.30 },
    ],
  ],
  [battle.UNIT_TRIBE_FALLEN_KING]: [
    // Tier 1
    [
      // Attack +5%
      { target: "attack", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-1" },
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-2" },
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-3" },
      { target: "power", mode: "constant", terrain: "hill", scheme: "hill-4" },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { target: "power", mode: "burst", operation: "multiply", value: 1.3, probability: 0.07 },
      { target: "power", mode: "burst", operation: "multiply", value: 1.5, probability: 0.10 },
      { target: "power", mode: "burst", operation: "multiply", value: 1.7, probability: 0.12 },
      { target: "power", mode: "burst", operation: "multiply", value: 2, probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_LEGENDARY]: [
    // Tier 1
    [
      // Attack +5%
      { target: "attack", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "attack", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Defence on ice
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-1" },
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-2" },
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-3" },
      { target: "defence", mode: "constant", terrain: "ice", scheme: "ice-4" },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { subEffect: "counter_attack", mode: "burst", probability: 0.07 },
      { subEffect: "counter_attack", mode: "burst", probability: 0.10 },
      { subEffect: "counter_attack", mode: "burst", probability: 0.12 },
      { subEffect: "counter_attack", mode: "burst", probability: 0.15 },
    ],
  ],
  [battle.UNIT_TRIBE_TITAN]: [
    // Tier 1
    [
      // Abilities power +5%
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.05 },
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.07 },
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.10 },
      { target: "abilities", mode: "constant", operation: "multiply", value: 1.15 },
    ],
    // Tier 2
    [
      // Defense on ice
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-1" },
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-2" },
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-3" },
      { subEffect: "lava_damage", mode: "constant", terrain: "lava", scheme: "lava-4" },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by +1
      { target: "speed", mode: "constant", trigger: "debuff", operation: "multiply", value: 1 },
      { target: "speed", mode: "constant", trigger: "debuff", operation: "multiply", value: 2 },
      { target: "speed", mode: "constant", trigger: "debuff", operation: "multiply", value: 3 },
      { target: "speed", mode: "constant", trigger: "debuff", operation: "multiply", value: 4 },
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