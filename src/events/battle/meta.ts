import * as battle from "./../../knightlands-shared/battle";

export const SETTINGS = {
  moveScheme: "rook",
  attackScheme: "queen",
  jumpScheme: "queen"
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

export const ABILITIES = {
  [battle.UNIT_CLASS_MELEE]: {
    [battle.ABILITY_POWER_STRIKE]: [
      [12, 14, 16, 17, 19], // Unit tier 1
      [16, 19, 21, 24, 26], // Unit tier 2
      [22, 25, 28, 32, 35], // Unit tier 3
    ],
    [battle.ABILITY_AXE_BLOW]: [
      [12, 14, 16, 17, 19],
      [16, 19, 21, 24, 26],
      [22, 25, 28, 32, 35],
    ],
    [battle.ABILITY_SPEAR_STRIKE]: [
      [12, 14, 16, 17, 19],
      [16, 19, 21, 24, 26],
      [22, 25, 28, 32, 35],
    ],
    [battle.ABILITY_STRONG_PUNCH]: [
      [12, 14, 16, 17, 19],
      [16, 19, 21, 24, 26],
      [22, 25, 28, 32, 35],
    ],
    [battle.ABILITY_DRAGON_BITE]: [
      [18, 20, 23, 26, 28],
      [24, 27, 31, 35, 38],
      [32, 37, 42, 47, 52],
    ],
    [battle.ABILITY_SWORD_CRUSH]: [
      null,
      [26, 30, 33, 37],
      [35, 40, 45, 50],
    ],
    [battle.ABILITY_AXE_CRUSH]: [
      null,
      [26, 30, 33, 37],
      [35, 40, 45, 50],
    ],
    [battle.ABILITY_WOLF_BITE]: [
      null,
      [26, 30, 33, 37],
      [35, 40, 45, 50],
    ],
    [battle.ABILITY_FURY_CLAWS]: [
      null,
      [26, 30, 33, 37],
      [35, 40, 45, 50],
    ],
    [battle.ABILITY_KUNAI_STRIKE]: [
      null,
      [26, 30, 33, 37],
      [35, 40, 45, 50],
    ],
    [battle.ABILITY_FIRE_BLADE]: [
      null,
      [26, 30, 33, 37],
      [35, 40, 45, 50],
    ],
    [battle.ABILITY_FROST_BLADE]: [
      null,
      [26, 30, 33, 37],
      [35, 40, 45, 50],
    ],
    [battle.ABILITY_RUSH]: [
      null,
      [7, 8, 9, 10],
      [10, 11, 13, 14],
    ],
    [battle.ABILITY_STUN_SHOT]: [
      null,
      [7, 8, 9, 10],
      [10, 11, 13, 14],
    ],
    [battle.ABILITY_LETHAL_STRIKE]: [
      null,
      null,
      [46, 56, 66],
    ],
    [battle.ABILITY_FATAL_STRIKE]: [
      null,
      null,
      [46, 56, 66],
    ],
    [battle.ABILITY_BLADE_VORTEX]: [
      null,
      null,
      [46, 56, 66],
    ],
    [battle.ABILITY_CRUSH_OF_DOOM]: [
      null,
      null,
      [46, 56, 66],
    ],
    [battle.ABILITY_DRAGON_FURY]: [
      null,
      null,
      [46, 56, 66],
    ],
    [battle.ABILITY_FROZEN_ABYSS]: [
      null,
      null,
      [39, 47, 55],
    ],
  },
  [battle.UNIT_CLASS_RANGE]: {
    [battle.ABILITY_JAVELIN_THROW]: [
      [16, 18, 20, 23, 25],
      [21, 24, 27, 31, 34],
      [28, 33, 37, 41, 46],
    ],
    [battle.ABILITY_POWER_SHOT]: [
      [16, 18, 20, 23, 25],
      [21, 24, 27, 31, 34],
      [28, 33, 37, 41, 46],
    ],
    [battle.ABILITY_DOUBLE_SHOT]: [
      null,
      [34, 39, 43, 48],
      [46, 52, 59, 65],
    ],
    [battle.ABILITY_ACCURATE_SHOT]: [
      null,
      [34, 39, 43, 48],
      [46, 52, 59, 65],
    ],
    [battle.ABILITY_ARROW_CRUSH]: [
      null,
      [34, 39, 43, 48],
      [46, 52, 59, 65],
    ],
    [battle.ABILITY_STUN_SHOT]: [
      null,
      [10, 11, 12, 13],
      [13, 15, 16, 18],
    ],
    [battle.ABILITY_DEATH_SHOT]: [
      null,
      null,
      [60, 73, 85],
    ],
    [battle.ABILITY_LETHAL_SHOT]: [
      null,
      null,
      [60, 73, 85],
    ],
    [battle.ABILITY_HAMSTRING]: [
      null,
      null,
      [50, 61, 71],
    ],
  },
  [battle.UNIT_CLASS_MAGE]: {
    [battle.ABILITY_FLAME_STRIKE]: [
      [18, 21, 23, 26, 29],
      [24, 28, 32, 35, 39],
      [33, 38, 43, 48, 53],
    ],
    [battle.ABILITY_ENERGY_BOLT]: [
      null,
      [39, 45, 50, 55],
      [53, 60, 68, 75],
    ],
    [battle.ABILITY_HURRICANE]: [
      null,
      [39, 45, 50, 55],
      [53, 60, 68, 75],
    ],
    [battle.ABILITY_DARK_VORTEX]: [
      null,
      null,
      [70, 84, 99],
    ],
  },
  [battle.UNIT_CLASS_TANK]: {
    [battle.ABILITY_HOLY_STRIKE]: [
      [8 , 10, 11, 12, 13],
      [11, 13, 15, 16, 18],
      [15, 18, 20, 22, 25],
    ],
    [battle.ABILITY_MORTAL_BLOW]: [
      [8 , 10, 11, 12, 13],
      [11, 13, 15, 16, 18],
      [15, 18, 20, 22, 25],
    ],
    [battle.ABILITY_HEAVY_STRIKE]: [
      [8 , 10, 11, 12, 13],
      [11, 13, 15, 16, 18],
      [15, 18, 20, 22, 25],
    ],
    [battle.ABILITY_SHIELD_STRIKE]: [
      null,
      [18, 21, 23, 26],
      [25, 28, 32, 35],
    ],
    [battle.ABILITY_RUSH]: [
      null,
      [5, 6, 7, 7],
      [7, 8, 9, 10],
    ],
    [battle.ABILITY_HUMMER_BLOW]: [
      null,
      null,
      [32, 39, 46],
    ],
    [battle.ABILITY_RETRIBUTION]: [
      null,
      null,
      [32, 39, 46],
    ],
    [battle.ABILITY_SHIELD_STUN]: [
      null,
      null,
      [8, 9, 11],
    ],
  },
  other: {
    [battle.ABILITY_SHIELD]: [
      [14, 16, 18, 20, 22],
      [18, 21, 24, 26, 29],
      [25, 28, 32, 36, 39],
    ],
    [battle.ABILITY_CURSE]: [
      [14, 16, 18, 20, 22],
      [18, 21, 24, 26, 29],
      [25, 28, 32, 36, 39],
    ],
    [battle.ABILITY_AGRESSION]: [
      [14, 16, 18, 20, 22],
      [18, 21, 24, 26, 29],
      [25, 28, 32, 36, 39],
    ],
    [battle.ABILITY_FLIGHT]: [
      null,
      [30, 34, 38, 42],
      [40, 45, 51, 56],
    ],
    [battle.ABILITY_RAGE]: [
      null,
      [30, 34, 38, 42],
      [40, 45, 51, 56],
    ],
    [battle.ABILITY_ZEALOT]: [
      null,
      [30, 34, 38, 42],
      [40, 45, 51, 56],
    ],
    [battle.ABILITY_DASH]: [
      null,
      [30, 34, 38, 42],
      [40, 45, 51, 56],
    ],
    [battle.ABILITY_HEAVY_ARROW]: [
      null,
      [30, 34, 38, 42],
      [40, 45, 51, 56],
    ],
    [battle.ABILITY_MIGHT]: [
      null,
      [30, 34, 38, 42],
      [40, 45, 51, 56],
    ],
    [battle.ABILITY_TELEPORTATION]: [
      null,
      [30, 34, 38, 42],
      [40, 45, 51, 56],
    ],
    [battle.ABILITY_WEAKNESS]: [
      null,
      [30, 34, 38, 42],
      [40, 45, 51, 56],
    ],
    [battle.ABILITY_SHIELD_WALL]: [
      null,
      null,
      [52, 63, 74],
    ],
    [battle.ABILITY_WIND_WALK]: [
      null,
      null,
      [52, 63, 74],
    ],
    [battle.ABILITY_LAZINESS]: [
      null,
      null,
      [52, 63, 74],
    ],
  },
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
      battle.ABILITY_TYPE_HEALING,
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
      battle.ABILITY_TYPE_HEALING,
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
      battle.ABILITY_TYPE_HEALING,
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
      battle.ABILITY_TYPE_HEALING,
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
      { bonusClass: "damage", modifier: 5 },
      { bonusClass: "damage", modifier: 7 },
      { bonusClass: "damage", modifier: 10 },
      { bonusClass: "damage", modifier: 15 },
    ],
    // Tier 2
    [
      // Swamp slows down by 25% less
      { bonusClass: "swamp_speed", modifier: 25 },
      { bonusClass: "swamp_speed", modifier: 50 },
      { bonusClass: "swamp_speed", modifier: 75 },
      { bonusClass: "swamp_speed", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { bonusClass: "defence_stack", modifier: 1, max: 5 },
      { bonusClass: "defence_stack", modifier: 1, max: 7 },
      { bonusClass: "defence_stack", modifier: 1, max: 10 },
      { bonusClass: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_DWARF]: [
    // Tier 1
    [
      // Attack +5%
      { bonusClass: "hp", modifier: 5 },
      { bonusClass: "hp", modifier: 7 },
      { bonusClass: "hp", modifier: 10 },
      { bonusClass: "hp", modifier: 15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { bonusClass: "hill_attack", modifier: 25 },
      { bonusClass: "hill_attack", modifier: 50 },
      { bonusClass: "hill_attack", modifier: 75 },
      { bonusClass: "hill_attack", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { bonusClass: "defence_stack", modifier: 1, max: 5 },
      { bonusClass: "defence_stack", modifier: 1, max: 7 },
      { bonusClass: "defence_stack", modifier: 1, max: 10 },
      { bonusClass: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_EGYPTIAN]: [
    // Tier 1
    [
      // Attack +5%
      { bonusClass: "damage", modifier: 5 },
      { bonusClass: "damage", modifier: 7 },
      { bonusClass: "damage", modifier: 10 },
      { bonusClass: "damage", modifier: 15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { bonusClass: "woods_defence", modifier: 25 },
      { bonusClass: "woods_defence", modifier: 50 },
      { bonusClass: "woods_defence", modifier: 75 },
      { bonusClass: "woods_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { bonusClass: "counter_attack", probability: 7 },
      { bonusClass: "counter_attack", probability: 10 },
      { bonusClass: "counter_attack", probability: 12 },
      { bonusClass: "counter_attack", probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_GOBLIN]: [
    // Tier 1
    [
      // HP +5%
      { bonusClass: "hp", modifier: 5 },
      { bonusClass: "hp", modifier: 7 },
      { bonusClass: "hp", modifier: 10 },
      { bonusClass: "hp", modifier: 15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { bonusClass: "woods_defence", modifier: 25 },
      { bonusClass: "woods_defence", modifier: 50 },
      { bonusClass: "woods_defence", modifier: 75 },
      { bonusClass: "woods_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by 5%
      { bonusClass: "debuff_speed", modifier: 5 },
      { bonusClass: "debuff_speed", modifier: 7 },
      { bonusClass: "debuff_speed", modifier: 10 },
      { bonusClass: "debuff_speed", modifier: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_INSECT]: [
    // Tier 1
    [
      // Defense +5%
      { bonusClass: "defence", modifier: 5 },
      { bonusClass: "defence", modifier: 7 },
      { bonusClass: "defence", modifier: 10 },
      { bonusClass: "defence", modifier: 15 },
    ],
    // Tier 2
    [
      // Swamp slows down by 25% less
      { bonusClass: "swamp_speed", modifier: 25 },
      { bonusClass: "swamp_speed", modifier: 50 },
      { bonusClass: "swamp_speed", modifier: 75 },
      { bonusClass: "swamp_speed", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { bonusClass: "defence_stack", modifier: 1, max: 5 },
      { bonusClass: "defence_stack", modifier: 1, max: 7 },
      { bonusClass: "defence_stack", modifier: 1, max: 10 },
      { bonusClass: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ORC]: [
    // Tier 1
    [
      // Attack +5%
      { bonusClass: "damage", modifier: 5 },
      { bonusClass: "damage", modifier: 7 },
      { bonusClass: "damage", modifier: 10 },
      { bonusClass: "damage", modifier: 15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { bonusClass: "hill_attack", modifier: 25 },
      { bonusClass: "hill_attack", modifier: 50 },
      { bonusClass: "hill_attack", modifier: 75 },
      { bonusClass: "hill_attack", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { bonusClass: "defence_stack", modifier: 1, max: 5 },
      { bonusClass: "defence_stack", modifier: 1, max: 7 },
      { bonusClass: "defence_stack", modifier: 1, max: 10 },
      { bonusClass: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ASSEMBLING]: [
    // Tier 1
    [
      // Abilities power +5%
      { bonusClass: "abilities", modifier: 5 },
      { bonusClass: "abilities", modifier: 7 },
      { bonusClass: "abilities", modifier: 10 },
      { bonusClass: "abilities", modifier: 15 },
    ],
    // Tier 2
    [
      // Swamp slows down by 25% less
      { bonusClass: "swamp_speed", modifier: 25 },
      { bonusClass: "swamp_speed", modifier: 50 },
      { bonusClass: "swamp_speed", modifier: 75 },
      { bonusClass: "swamp_speed", modifier: 100 },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { bonusClass: "crit", modifier: 1.3, probability: 7 },
      { bonusClass: "crit", modifier: 1.5, probability: 10 },
      { bonusClass: "crit", modifier: 1.7, probability: 12 },
      { bonusClass: "crit", modifier: 2, probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ICE]: [
    // Tier 1
    [
      // Defense +5%
      { bonusClass: "defence", modifier: 5 },
      { bonusClass: "defence", modifier: 7 },
      { bonusClass: "defence", modifier: 10 },
      { bonusClass: "defence", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { bonusClass: "ice_defence", modifier: 25 },
      { bonusClass: "ice_defence", modifier: 50 },
      { bonusClass: "ice_defence", modifier: 75 },
      { bonusClass: "ice_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by 5%
      { bonusClass: "debuff_speed", modifier: 5 },
      { bonusClass: "debuff_speed", modifier: 7 },
      { bonusClass: "debuff_speed", modifier: 10 },
      { bonusClass: "debuff_speed", modifier: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_CLOCKWORK]: [
    // Tier 1
    [
      // Defense +5%
      { bonusClass: "defence", modifier: 5 },
      { bonusClass: "defence", modifier: 7 },
      { bonusClass: "defence", modifier: 10 },
      { bonusClass: "defence", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { bonusClass: "lava_damage", modifier: -25 },
      { bonusClass: "lava_damage", modifier: -50 },
      { bonusClass: "lava_damage", modifier: -75 },
      { bonusClass: "lava_damage", modifier: -100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { bonusClass: "defence_stack", modifier: 1, max: 5 },
      { bonusClass: "defence_stack", modifier: 1, max: 7 },
      { bonusClass: "defence_stack", modifier: 1, max: 10 },
      { bonusClass: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ELDRITCH]: [
    // Tier 1
    [
      // Defense +5%
      { bonusClass: "hp", modifier: 5 },
      { bonusClass: "hp", modifier: 7 },
      { bonusClass: "hp", modifier: 10 },
      { bonusClass: "hp", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { bonusClass: "lava_damage", modifier: -25 },
      { bonusClass: "lava_damage", modifier: -50 },
      { bonusClass: "lava_damage", modifier: -75 },
      { bonusClass: "lava_damage", modifier: -100 },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { bonusClass: "crit", modifier: 1.3, probability: 7 },
      { bonusClass: "crit", modifier: 1.5, probability: 10 },
      { bonusClass: "crit", modifier: 1.7, probability: 12 },
      { bonusClass: "crit", modifier: 2, probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ELF]: [
    // Tier 1
    [
      // Abilities power +5%
      { bonusClass: "abilities", modifier: 5 },
      { bonusClass: "abilities", modifier: 7 },
      { bonusClass: "abilities", modifier: 10 },
      { bonusClass: "abilities", modifier: 15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { bonusClass: "woods_defence", modifier: 25 },
      { bonusClass: "woods_defence", modifier: 50 },
      { bonusClass: "woods_defence", modifier: 75 },
      { bonusClass: "woods_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { bonusClass: "counter_attack", probability: 7 },
      { bonusClass: "counter_attack", probability: 10 },
      { bonusClass: "counter_attack", probability: 12 },
      { bonusClass: "counter_attack", probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_SKELETON]: [
    // Tier 1
    [
      // Abilities power +5%
      { bonusClass: "hp", modifier: 5 },
      { bonusClass: "hp", modifier: 7 },
      { bonusClass: "hp", modifier: 10 },
      { bonusClass: "hp", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { bonusClass: "ice_defence", modifier: 25 },
      { bonusClass: "ice_defence", modifier: 50 },
      { bonusClass: "ice_defence", modifier: 75 },
      { bonusClass: "ice_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { bonusClass: "defence_stack", modifier: 1, max: 5 },
      { bonusClass: "defence_stack", modifier: 1, max: 7 },
      { bonusClass: "defence_stack", modifier: 1, max: 10 },
      { bonusClass: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_FALLEN_KING]: [
    // Tier 1
    [
      // Attack +5%
      { bonusClass: "damage", modifier: 5 },
      { bonusClass: "damage", modifier: 7 },
      { bonusClass: "damage", modifier: 10 },
      { bonusClass: "damage", modifier: 15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { bonusClass: "hill_attack", modifier: 25 },
      { bonusClass: "hill_attack", modifier: 50 },
      { bonusClass: "hill_attack", modifier: 75 },
      { bonusClass: "hill_attack", modifier: 100 },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { bonusClass: "crit", modifier: 1.3, probability: 7 },
      { bonusClass: "crit", modifier: 1.5, probability: 10 },
      { bonusClass: "crit", modifier: 1.7, probability: 12 },
      { bonusClass: "crit", modifier: 2, probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_TITAN]: [
    // Tier 1
    [
      // Abilities power +5%
      { bonusClass: "abilities", modifier: 5 },
      { bonusClass: "abilities", modifier: 7 },
      { bonusClass: "abilities", modifier: 10 },
      { bonusClass: "abilities", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { bonusClass: "lava_damage", modifier: -25 },
      { bonusClass: "lava_damage", modifier: -50 },
      { bonusClass: "lava_damage", modifier: -75 },
      { bonusClass: "lava_damage", modifier: -100 },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by 5%
      { bonusClass: "debuff_speed", modifier: 5 },
      { bonusClass: "debuff_speed", modifier: 7 },
      { bonusClass: "debuff_speed", modifier: 10 },
      { bonusClass: "debuff_speed", modifier: 15 },
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
  [
    { terrainId: "45c43rv", terrainClass: battle.TERRAIN_GRASS, index: 0 },
    {
      terrainId: "v34vt34",
      terrainClass: battle.TERRAIN_GRASS_SWAMP,
      index: 1
    },
    {
      terrainId: "c4c435t",
      terrainClass: battle.TERRAIN_GRASS_WOODS,
      index: 2
    },
    { terrainId: "1", terrainClass: battle.TERRAIN_GRASS_HILL, index: 3 },
    { terrainId: "2", terrainClass: battle.TERRAIN_GRASS, index: 4 },
    { terrainId: "3", terrainClass: battle.TERRAIN_GRASS, index: 5 },
    {
      terrainId: "4",
      terrainClass: battle.TERRAIN_GRASS_SWAMP_X,
      index: 6
    },
    {
      terrainId: "5",
      terrainClass: battle.TERRAIN_GRASS_SWAMP_Y,
      index: 7
    },
    {
      terrainId: "6",
      terrainClass: battle.TERRAIN_GRASS_SWAMP_Y,
      index: 8
    },
    {
      terrainId: "7",
      terrainClass: battle.TERRAIN_GRASS_SWAMP_Z,
      index: 9
    },
    { terrainId: "8", terrainClass: battle.TERRAIN_GRASS, index: 10 },
    { terrainId: "8", terrainClass: battle.TERRAIN_GRASS, index: 11 },
    { terrainId: "9", terrainClass: battle.TERRAIN_GRASS, index: 12 },
    { terrainId: "10", terrainClass: battle.TERRAIN_GRASS, index: 13 },
    {
      terrainId: "11",
      terrainClass: battle.TERRAIN_GRASS_WOODS,
      index: 14
    },
    {
      terrainId: "12",
      terrainClass: battle.TERRAIN_GRASS_WOODS,
      index: 15
    },
    {
      terrainId: "13",
      terrainClass: battle.TERRAIN_GRASS_WOODS,
      index: 16
    },
    { terrainId: "14", terrainClass: battle.TERRAIN_GRASS, index: 17 },
    { terrainId: "15", terrainClass: battle.TERRAIN_GRASS, index: 18 },
    { terrainId: "16", terrainClass: battle.TERRAIN_GRASS, index: 19 },
    { terrainId: "17", terrainClass: battle.TERRAIN_GRASS, index: 20 },
    { terrainId: "18", terrainClass: battle.TERRAIN_GRASS, index: 21 },
    { terrainId: "19", terrainClass: battle.TERRAIN_GRASS, index: 22 },
    { terrainId: "20", terrainClass: battle.TERRAIN_GRASS, index: 23 },
    { terrainId: "21", terrainClass: battle.TERRAIN_GRASS, index: 24 },
    {
      terrainId: "22",
      terrainClass: battle.TERRAIN_GRASS_WOODS,
      index: 25
    },
    { terrainId: "23", terrainClass: battle.TERRAIN_GRASS, index: 26 },
    { terrainId: "24", terrainClass: battle.TERRAIN_GRASS, index: 27 },
    {
      terrainId: "25",
      terrainClass: battle.TERRAIN_GRASS_WOODS,
      index: 28
    },
    { terrainId: "26", terrainClass: battle.TERRAIN_GRASS, index: 29 },
    { terrainId: "27", terrainClass: battle.TERRAIN_GRASS, index: 30 },
    { terrainId: "28", terrainClass: battle.TERRAIN_GRASS, index: 31 },
    { terrainId: "29", terrainClass: battle.TERRAIN_GRASS, index: 32 },
    { terrainId: "30", terrainClass: battle.TERRAIN_GRASS, index: 33 },
    { terrainId: "31", terrainClass: battle.TERRAIN_GRASS, index: 34 }
  ]
];

export const ABILITY_SCHEME = [
  [{cd: 5, lvl: 1}, null, null], // unit lvl 1
  [{cd: 5, lvl: 1}, null, null],
  [{cd: 5, lvl: 1}, null, null],
  [{cd: 4, lvl: 2}, null, null], // unit lvl 4
  [{cd: 4, lvl: 2}, null, null], 
  [{cd: 4, lvl: 2}, null, null], 
  [{cd: 3, lvl: 3}, null, null], // unit lvl 7
  [{cd: 3, lvl: 3}, null, null],
  [{cd: 3, lvl: 3}, null, null],
  [{cd: 3, lvl: 4}, null, null], // unit lvl 10
  [{cd: 3, lvl: 4}, null, null], 
  [{cd: 3, lvl: 4}, null, null], 
  [{cd: 3, lvl: 5}, null, null], // unit lvl 13
  [{cd: 3, lvl: 5}, null, null],
  [{cd: 3, lvl: 5}, null, null],
  
  [{cd: 3, lvl: 6}, {cd: 5, lvl: 1}, null], // unit lvl 16
  [{cd: 3, lvl: 6}, {cd: 5, lvl: 1}, null],
  [{cd: 3, lvl: 6}, {cd: 5, lvl: 1}, null],
  [{cd: 3, lvl: 7}, {cd: 5, lvl: 1}, null], // unit lvl 19
  [{cd: 3, lvl: 7}, {cd: 4, lvl: 2}, null], // unit lvl 20
  [{cd: 3, lvl: 7}, {cd: 4, lvl: 2}, null],
  [{cd: 3, lvl: 8}, {cd: 4, lvl: 2}, null], // unit lvl 22
  [{cd: 3, lvl: 8}, {cd: 4, lvl: 2}, null],
  [{cd: 3, lvl: 8}, {cd: 3, lvl: 3}, null], // unit lvl 24
  [{cd: 3, lvl: 9}, {cd: 3, lvl: 3}, null], // unit lvl 25
  [{cd: 3, lvl: 9}, {cd: 3, lvl: 3}, null],
  [{cd: 3, lvl: 9}, {cd: 3, lvl: 3}, null],
  [{cd: 3, lvl: 10}, {cd: 3, lvl: 4}, null], // unit lvl 28
  [{cd: 3, lvl: 10}, {cd: 3, lvl: 4}, null],
  [{cd: 3, lvl: 10}, {cd: 3, lvl: 4}, null],

  [{cd: 3, lvl: 11}, {cd: 3, lvl: 5}, {cd: 5, lvl: 1}], // unit lvl 31
  [{cd: 3, lvl: 11}, {cd: 3, lvl: 5}, {cd: 5, lvl: 1}],
  [{cd: 3, lvl: 11}, {cd: 3, lvl: 5}, {cd: 5, lvl: 1}],
  [{cd: 3, lvl: 12}, {cd: 3, lvl: 5}, {cd: 5, lvl: 1}], // unit lvl 34
  [{cd: 3, lvl: 12}, {cd: 3, lvl: 6}, {cd: 5, lvl: 1}], // unit lvl 35
  [{cd: 3, lvl: 12}, {cd: 3, lvl: 6}, {cd: 4, lvl: 2}], // unit lvl 36
  [{cd: 3, lvl: 13}, {cd: 3, lvl: 6}, {cd: 4, lvl: 2}], // unit lvl 37
  [{cd: 3, lvl: 13}, {cd: 3, lvl: 6}, {cd: 4, lvl: 2}],
  [{cd: 3, lvl: 13}, {cd: 3, lvl: 7}, {cd: 4, lvl: 2}], // unit lvl 39
  [{cd: 3, lvl: 14}, {cd: 3, lvl: 7}, {cd: 4, lvl: 2}], // unit lvl 40
  [{cd: 3, lvl: 14}, {cd: 3, lvl: 7}, {cd: 4, lvl: 2}],
  [{cd: 3, lvl: 14}, {cd: 3, lvl: 7}, {cd: 3, lvl: 3}], // unit lvl 42
  [{cd: 3, lvl: 15}, {cd: 3, lvl: 8}, {cd: 3, lvl: 3}], // unit lvl 43
  [{cd: 3, lvl: 15}, {cd: 3, lvl: 8}, {cd: 3, lvl: 3}],
  [{cd: 3, lvl: 15}, {cd: 3, lvl: 8}, {cd: 3, lvl: 3}],
];