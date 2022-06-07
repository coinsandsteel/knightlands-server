import * as battle from "./../../knightlands-shared/battle";

export const CHARACTERISTICS = {
  [battle.UNIT_CLASS_MELEE]: [
    // Tier 1
    [
      { hp: 71, damage: 7, defence: 3, speed: 2, initiative: 4 },
      { hp: 74, damage: 7, defence: 3, speed: 2, initiative: 4 },
      { hp: 78, damage: 8, defence: 3, speed: 2, initiative: 4 },
      { hp: 81, damage: 8, defence: 3, speed: 2, initiative: 4 },
      { hp: 85, damage: 8, defence: 4, speed: 2, initiative: 4 },
      { hp: 88, damage: 9, defence: 4, speed: 2, initiative: 4 },
      { hp: 92, damage: 9, defence: 4, speed: 2, initiative: 4 },
      { hp: 95, damage: 10, defence: 4, speed: 2, initiative: 4 },
      { hp: 99, damage: 10, defence: 4, speed: 2, initiative: 4 },
      { hp: 103, damage: 10, defence: 4, speed: 2, initiative: 4 },
      { hp: 106, damage: 11, defence: 4, speed: 2, initiative: 4 },
      { hp: 110, damage: 11, defence: 4, speed: 2, initiative: 4 },
      { hp: 113, damage: 11, defence: 5, speed: 2, initiative: 4 },
      { hp: 117, damage: 12, defence: 5, speed: 2, initiative: 4 },
      { hp: 120, damage: 12, defence: 5, speed: 2, initiative: 4 },
    ],
    // Tier 2
    [
      { hp: 95, damage: 10, defence: 6, speed: 2, initiative: 4 },
      { hp: 100, damage: 10, defence: 6, speed: 2, initiative: 4 },
      { hp: 105, damage: 11, defence: 7, speed: 2, initiative: 4 },
      { hp: 110, damage: 11, defence: 7, speed: 2, initiative: 4 },
      { hp: 115, damage: 11, defence: 7, speed: 2, initiative: 4 },
      { hp: 119, damage: 12, defence: 7, speed: 2, initiative: 4 },
      { hp: 124, damage: 12, defence: 8, speed: 2, initiative: 4 },
      { hp: 129, damage: 13, defence: 8, speed: 2, initiative: 4 },
      { hp: 134, damage: 13, defence: 8, speed: 2, initiative: 4 },
      { hp: 138, damage: 14, defence: 8, speed: 2, initiative: 4 },
      { hp: 143, damage: 14, defence: 9, speed: 2, initiative: 4 },
      { hp: 148, damage: 15, defence: 9, speed: 2, initiative: 4 },
      { hp: 153, damage: 15, defence: 9, speed: 2, initiative: 4 },
      { hp: 158, damage: 16, defence: 9, speed: 2, initiative: 4 },
      { hp: 162, damage: 16, defence: 10, speed: 2, initiative: 4 },
    ],
    // Tier 3
    [
      { hp: 129, damage: 13, defence: 11, speed: 3, initiative: 6 },
      { hp: 135, damage: 14, defence: 11, speed: 3, initiative: 6 },
      { hp: 142, damage: 14, defence: 12, speed: 3, initiative: 6 },
      { hp: 148, damage: 15, defence: 12, speed: 3, initiative: 6 },
      { hp: 155, damage: 15, defence: 12, speed: 3, initiative: 6 },
      { hp: 161, damage: 16, defence: 12, speed: 3, initiative: 6 },
      { hp: 168, damage: 17, defence: 13, speed: 3, initiative: 6 },
      { hp: 174, damage: 17, defence: 13, speed: 3, initiative: 6 },
      { hp: 180, damage: 18, defence: 13, speed: 3, initiative: 6 },
      { hp: 187, damage: 19, defence: 13, speed: 3, initiative: 6 },
      { hp: 193, damage: 19, defence: 14, speed: 3, initiative: 6 },
      { hp: 200, damage: 20, defence: 14, speed: 3, initiative: 6 },
      { hp: 206, damage: 21, defence: 14, speed: 3, initiative: 6 },
      { hp: 213, damage: 21, defence: 14, speed: 3, initiative: 6 },
      { hp: 219, damage: 22, defence: 15, speed: 3, initiative: 6 },
    ]
  ],
  [battle.UNIT_CLASS_RANGE]: [
    // Tier 1
    [
      //{ hp: 10, damage: 3, defence: 7, initiative: 1, speed: 4 }
      { hp: 49, damage: 9, defence: 2, speed: 3, initiative: 6 },
      { hp: 52, damage: 10, defence: 2, speed: 3, initiative: 6 },
      { hp: 54, damage: 10, defence: 2, speed: 3, initiative: 6 },
      { hp: 57, damage: 11, defence: 2, speed: 3, initiative: 6 },
      { hp: 59, damage: 11, defence: 3, speed: 3, initiative: 6 },
      { hp: 62, damage: 11, defence: 3, speed: 3, initiative: 6 },
      { hp: 64, damage: 12, defence: 3, speed: 3, initiative: 6 },
      { hp: 67, damage: 12, defence: 3, speed: 3, initiative: 6 },
      { hp: 69, damage: 13, defence: 3, speed: 3, initiative: 6 },
      { hp: 72, damage: 13, defence: 3, speed: 3, initiative: 6 },
      { hp: 74, damage: 14, defence: 3, speed: 3, initiative: 6 },
      { hp: 77, damage: 14, defence: 3, speed: 3, initiative: 6 },
      { hp: 79, damage: 15, defence: 4, speed: 3, initiative: 6 },
      { hp: 82, damage: 15, defence: 4, speed: 3, initiative: 6 },
      { hp: 84, damage: 16, defence: 4, speed: 3, initiative: 6 },
    ],
    // Tier 2
    [
      { hp: 67, damage: 12, defence: 4, speed: 3, initiative: 6 },
      { hp: 70, damage: 13, defence: 4, speed: 3, initiative: 6 },
      { hp: 74, damage: 14, defence: 4, speed: 3, initiative: 6 },
      { hp: 77, damage: 14, defence: 4, speed: 3, initiative: 6 },
      { hp: 80, damage: 15, defence: 5, speed: 3, initiative: 6 },
      { hp: 84, damage: 16, defence: 5, speed: 3, initiative: 6 },
      { hp: 87, damage: 16, defence: 5, speed: 3, initiative: 6 },
      { hp: 90, damage: 17, defence: 5, speed: 3, initiative: 6 },
      { hp: 94, damage: 17, defence: 5, speed: 3, initiative: 6 },
      { hp: 97, damage: 18, defence: 6, speed: 3, initiative: 6 },
      { hp: 100, damage: 19, defence: 6, speed: 3, initiative: 6 },
      { hp: 104, damage: 19, defence: 6, speed: 3, initiative: 6 },
      { hp: 107, damage: 20, defence: 6, speed: 3, initiative: 6 },
      { hp: 110, damage: 20, defence: 6, speed: 3, initiative: 6 },
      { hp: 114, damage: 21, defence: 7, speed: 3, initiative: 6 },
    ],
    // Tier 3
    [
      { hp: 90, damage: 17, defence: 7, speed: 4, initiative: 8 },
      { hp: 95, damage: 18, defence: 7, speed: 4, initiative: 8 },
      { hp: 99, damage: 18, defence: 7, speed: 4, initiative: 8 },
      { hp: 104, damage: 19, defence: 7, speed: 4, initiative: 8 },
      { hp: 108, damage: 20, defence: 7, speed: 4, initiative: 8 },
      { hp: 113, damage: 21, defence: 8, speed: 4, initiative: 8 },
      { hp: 117, damage: 22, defence: 8, speed: 4, initiative: 8 },
      { hp: 122, damage: 23, defence: 8, speed: 4, initiative: 8 },
      { hp: 126, damage: 23, defence: 8, speed: 4, initiative: 8 },
      { hp: 131, damage: 24, defence: 8, speed: 4, initiative: 8 },
      { hp: 135, damage: 25, defence: 9, speed: 4, initiative: 8 },
      { hp: 140, damage: 26, defence: 9, speed: 4, initiative: 8 },
      { hp: 144, damage: 27, defence: 9, speed: 4, initiative: 8 },
      { hp: 149, damage: 28, defence: 9, speed: 4, initiative: 8 },
      { hp: 153, damage: 28, defence: 9, speed: 4, initiative: 8 },
    ]
  ],
  [battle.UNIT_CLASS_MAGE]: [
    // Tier 1
    [
      //{ hp: 10, damage: 3, defence: 7, initiative: 1, speed: 4 }
      { hp: 42, damage: 11, defence: 1, speed: 2, initiative: 4 },
      { hp: 45, damage: 11, defence: 1, speed: 2, initiative: 4 },
      { hp: 47, damage: 12, defence: 1, speed: 2, initiative: 4 },
      { hp: 49, damage: 12, defence: 1, speed: 2, initiative: 4 },
      { hp: 51, damage: 13, defence: 2, speed: 2, initiative: 4 },
      { hp: 53, damage: 13, defence: 2, speed: 2, initiative: 4 },
      { hp: 55, damage: 14, defence: 2, speed: 2, initiative: 4 },
      { hp: 57, damage: 14, defence: 2, speed: 2, initiative: 4 },
      { hp: 59, damage: 15, defence: 2, speed: 2, initiative: 4 },
      { hp: 62, damage: 15, defence: 2, speed: 2, initiative: 4 },
      { hp: 64, damage: 16, defence: 2, speed: 2, initiative: 4 },
      { hp: 66, damage: 16, defence: 2, speed: 2, initiative: 4 },
      { hp: 68, damage: 17, defence: 3, speed: 2, initiative: 4 },
      { hp: 70, damage: 18, defence: 3, speed: 2, initiative: 4 },
      { hp: 72, damage: 18, defence: 3, speed: 2, initiative: 4 },
    ],
    // Tier 2
    [
      { hp: 57, damage: 14, defence: 3, speed: 2, initiative: 4 },
      { hp: 60, damage: 15, defence: 3, speed: 2, initiative: 4 },
      { hp: 63, damage: 16, defence: 3, speed: 2, initiative: 4 },
      { hp: 66, damage: 16, defence: 3, speed: 2, initiative: 4 },
      { hp: 69, damage: 17, defence: 3, speed: 2, initiative: 4 },
      { hp: 72, damage: 18, defence: 4, speed: 2, initiative: 4 },
      { hp: 74, damage: 19, defence: 4, speed: 2, initiative: 4 },
      { hp: 77, damage: 19, defence: 4, speed: 2, initiative: 4 },
      { hp: 80, damage: 20, defence: 4, speed: 2, initiative: 4 },
      { hp: 83, damage: 21, defence: 4, speed: 2, initiative: 4 },
      { hp: 86, damage: 21, defence: 4, speed: 2, initiative: 4 },
      { hp: 89, damage: 22, defence: 4, speed: 2, initiative: 4 },
      { hp: 92, damage: 23, defence: 4, speed: 2, initiative: 4 },
      { hp: 95, damage: 24, defence: 5, speed: 2, initiative: 4 },
      { hp: 97, damage: 24, defence: 5, speed: 2, initiative: 4 },
    ],
    // Tier 3
    [
      { hp: 77, damage: 19, defence: 5, speed: 3, initiative: 6 },
      { hp: 81, damage: 20, defence: 5, speed: 3, initiative: 6 },
      { hp: 85, damage: 21, defence: 5, speed: 3, initiative: 6 },
      { hp: 89, damage: 22, defence: 5, speed: 3, initiative: 6 },
      { hp: 93, damage: 23, defence: 5, speed: 3, initiative: 6 },
      { hp: 97, damage: 24, defence: 5, speed: 3, initiative: 6 },
      { hp: 101, damage: 25, defence: 6, speed: 3, initiative: 6 },
      { hp: 104, damage: 26, defence: 6, speed: 3, initiative: 6 },
      { hp: 108, damage: 27, defence: 6, speed: 3, initiative: 6 },
      { hp: 112, damage: 28, defence: 6, speed: 3, initiative: 6 },
      { hp: 116, damage: 29, defence: 6, speed: 3, initiative: 6 },
      { hp: 120, damage: 30, defence: 6, speed: 3, initiative: 6 },
      { hp: 124, damage: 31, defence: 6, speed: 3, initiative: 6 },
      { hp: 128, damage: 32, defence: 6, speed: 3, initiative: 6 },
      { hp: 131, damage: 33, defence: 7, speed: 3, initiative: 6 },
    ]
  ],
  [battle.UNIT_CLASS_TANK]: [
    // Tier 1
    [
      //{ hp: 10, damage: 3, defence: 7, initiative: 1, speed: 4 }
      { hp: 92, damage: 5, defence: 10, speed: 2, initiative: 4 },
      { hp: 97, damage: 5, defence: 10, speed: 2, initiative: 4 },
      { hp: 101, damage: 5, defence: 11, speed: 2, initiative: 4 },
      { hp: 106, damage: 6, defence: 11, speed: 2, initiative: 4 },
      { hp: 110, damage: 6, defence: 11, speed: 2, initiative: 4 },
      { hp: 115, damage: 6, defence: 12, speed: 2, initiative: 4 },
      { hp: 120, damage: 6, defence: 12, speed: 2, initiative: 4 },
      { hp: 124, damage: 7, defence: 12, speed: 2, initiative: 4 },
      { hp: 129, damage: 7, defence: 13, speed: 2, initiative: 4 },
      { hp: 133, damage: 7, defence: 13, speed: 2, initiative: 4 },
      { hp: 138, damage: 7, defence: 13, speed: 2, initiative: 4 },
      { hp: 142, damage: 8, defence: 14, speed: 2, initiative: 4 },
      { hp: 147, damage: 8, defence: 14, speed: 2, initiative: 4 },
      { hp: 152, damage: 8, defence: 14, speed: 2, initiative: 4 },
      { hp: 156, damage: 8, defence: 15, speed: 2, initiative: 4 },
    ],
    // Tier 2
    [
      { hp: 124, damage: 7, defence: 15, speed: 2, initiative: 4 },
      { hp: 130, damage: 7, defence: 15, speed: 2, initiative: 4 },
      { hp: 137, damage: 7, defence: 15, speed: 2, initiative: 4 },
      { hp: 143, damage: 8, defence: 16, speed: 2, initiative: 4 },
      { hp: 149, damage: 8, defence: 16, speed: 2, initiative: 4 },
      { hp: 155, damage: 8, defence: 16, speed: 2, initiative: 4 },
      { hp: 161, damage: 9, defence: 17, speed: 2, initiative: 4 },
      { hp: 168, damage: 9, defence: 17, speed: 2, initiative: 4 },
      { hp: 174, damage: 9, defence: 17, speed: 2, initiative: 4 },
      { hp: 180, damage: 10, defence: 18, speed: 2, initiative: 4 },
      { hp: 186, damage: 10, defence: 18, speed: 2, initiative: 4 },
      { hp: 192, damage: 10, defence: 18, speed: 2, initiative: 4 },
      { hp: 199, damage: 11, defence: 19, speed: 2, initiative: 4 },
      { hp: 205, damage: 11, defence: 19, speed: 2, initiative: 4 },
      { hp: 211, damage: 11, defence: 19, speed: 2, initiative: 4 },
    ],
    // Tier 3
    [
      { hp: 168, damage: 9, defence: 19, speed: 3, initiative: 6 },
      { hp: 176, damage: 9, defence: 20, speed: 3, initiative: 6 },
      { hp: 184, damage: 10, defence: 20, speed: 3, initiative: 6 },
      { hp: 193, damage: 10, defence: 20, speed: 3, initiative: 6 },
      { hp: 201, damage: 11, defence: 21, speed: 3, initiative: 6 },
      { hp: 209, damage: 11, defence: 21, speed: 3, initiative: 6 },
      { hp: 218, damage: 12, defence: 21, speed: 3, initiative: 6 },
      { hp: 226, damage: 12, defence: 22, speed: 3, initiative: 6 },
      { hp: 235, damage: 13, defence: 22, speed: 3, initiative: 6 },
      { hp: 243, damage: 13, defence: 22, speed: 3, initiative: 6 },
      { hp: 251, damage: 14, defence: 23, speed: 3, initiative: 6 },
      { hp: 260, damage: 14, defence: 23, speed: 3, initiative: 6 },
      { hp: 268, damage: 14, defence: 23, speed: 3, initiative: 6 },
      { hp: 276, damage: 15, defence: 24, speed: 3, initiative: 6 },
      { hp: 285, damage: 15, defence: 24, speed: 3, initiative: 6 },
    ]
  ],
  [battle.UNIT_CLASS_SUPPORT]: [
    // Tier 1
    [
      //{ hp: 10, damage: 3, defence: 7, initiative: 1, speed: 4 }
      { hp: 49, damage: 5, defence: 10, speed: 2, initiative: 4 },
      { hp: 52, damage: 5, defence: 10, speed: 2, initiative: 4 },
      { hp: 54, damage: 5, defence: 11, speed: 2, initiative: 4 },
      { hp: 57, damage: 6, defence: 11, speed: 2, initiative: 4 },
      { hp: 59, damage: 6, defence: 11, speed: 2, initiative: 4 },
      { hp: 62, damage: 6, defence: 12, speed: 2, initiative: 4 },
      { hp: 64, damage: 6, defence: 12, speed: 2, initiative: 4 },
      { hp: 67, damage: 7, defence: 12, speed: 2, initiative: 4 },
      { hp: 69, damage: 7, defence: 13, speed: 2, initiative: 4 },
      { hp: 72, damage: 7, defence: 13, speed: 2, initiative: 4 },
      { hp: 74, damage: 7, defence: 13, speed: 2, initiative: 4 },
      { hp: 77, damage: 8, defence: 14, speed: 2, initiative: 4 },
      { hp: 79, damage: 8, defence: 14, speed: 2, initiative: 4 },
      { hp: 82, damage: 8, defence: 14, speed: 2, initiative: 4 },
      { hp: 84, damage: 8, defence: 15, speed: 2, initiative: 4 },
    ],
    // Tier 2
    [
      { hp: 67, damage: 7, defence: 15, speed: 2, initiative: 4 },
      { hp: 70, damage: 7, defence: 15, speed: 2, initiative: 4 },
      { hp: 74, damage: 7, defence: 15, speed: 2, initiative: 4 },
      { hp: 77, damage: 8, defence: 16, speed: 2, initiative: 4 },
      { hp: 80, damage: 8, defence: 16, speed: 2, initiative: 4 },
      { hp: 84, damage: 8, defence: 16, speed: 2, initiative: 4 },
      { hp: 87, damage: 9, defence: 17, speed: 2, initiative: 4 },
      { hp: 90, damage: 9, defence: 17, speed: 2, initiative: 4 },
      { hp: 94, damage: 9, defence: 17, speed: 2, initiative: 4 },
      { hp: 97, damage: 10, defence: 18, speed: 2, initiative: 4 },
      { hp: 100, damage: 10, defence: 18, speed: 2, initiative: 4 },
      { hp: 104, damage: 10, defence: 18, speed: 2, initiative: 4 },
      { hp: 107, damage: 11, defence: 19, speed: 2, initiative: 4 },
      { hp: 110, damage: 11, defence: 19, speed: 2, initiative: 4 },
      { hp: 114, damage: 11, defence: 19, speed: 2, initiative: 4 },
    ],
    // Tier 3
    [
      { hp: 90, damage: 9, defence: 19, speed: 3, initiative: 6 },
      { hp: 95, damage: 9, defence: 20, speed: 3, initiative: 6 },
      { hp: 99, damage: 10, defence: 20, speed: 3, initiative: 6 },
      { hp: 104, damage: 10, defence: 20, speed: 3, initiative: 6 },
      { hp: 108, damage: 11, defence: 21, speed: 3, initiative: 6 },
      { hp: 113, damage: 11, defence: 21, speed: 3, initiative: 6 },
      { hp: 117, damage: 12, defence: 21, speed: 3, initiative: 6 },
      { hp: 122, damage: 12, defence: 22, speed: 3, initiative: 6 },
      { hp: 126, damage: 13, defence: 22, speed: 3, initiative: 6 },
      { hp: 131, damage: 13, defence: 22, speed: 3, initiative: 6 },
      { hp: 135, damage: 14, defence: 23, speed: 3, initiative: 6 },
      { hp: 140, damage: 14, defence: 23, speed: 3, initiative: 6 },
      { hp: 144, damage: 14, defence: 23, speed: 3, initiative: 6 },
      { hp: 149, damage: 15, defence: 24, speed: 3, initiative: 6 },
      { hp: 153, damage: 15, defence: 24, speed: 3, initiative: 6 },
    ]
  ],
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
};

export const UNITS = [
  //battle.UNIT_TRIBE_KOBOLD
  {
    template: 1,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 2,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_JAVELIN_THROW,
      battle.ABILITY_FLIGHT,
      battle.ABILITY_LETHAL_SHOT,
    ]
  },
  {
    template: 3,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 4,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_MORTAL_BLOW,
      battle.ABILITY_FLIGHT,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 5,
    unitTribe: battle.UNIT_TRIBE_KOBOLD,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
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
    abilities: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_STUN,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 7,
    unitTribe: battle.UNIT_TRIBE_DWARF,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_AXE_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 8,
    unitTribe: battle.UNIT_TRIBE_DWARF,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_RUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 9,
    unitTribe: battle.UNIT_TRIBE_DWARF,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
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
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_ACCURATE_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 11,
    unitTribe: battle.UNIT_TRIBE_EGYPTIAN,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_DASH,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 12,
    unitTribe: battle.UNIT_TRIBE_EGYPTIAN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_AXE_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 13,
    unitTribe: battle.UNIT_TRIBE_EGYPTIAN,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_HEAVY_STRIKE,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 14,
    unitTribe: battle.UNIT_TRIBE_EGYPTIAN,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
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
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 16,
    unitTribe: battle.UNIT_TRIBE_GOBLIN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 17,
    unitTribe: battle.UNIT_TRIBE_GOBLIN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_SPEAR_STRIKE,
      battle.ABILITY_WOLF_BITE,
      battle.ABILITY_FATAL_STRIKE,
    ]
  },
  {
    template: 18,
    unitTribe: battle.UNIT_TRIBE_GOBLIN,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_HOLY_STRIKE,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 19,
    unitTribe: battle.UNIT_TRIBE_GOBLIN,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
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
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 21,
    unitTribe: battle.UNIT_TRIBE_INSECT,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 22,
    unitTribe: battle.UNIT_TRIBE_INSECT,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 23,
    unitTribe: battle.UNIT_TRIBE_INSECT,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 24,
    unitTribe: battle.UNIT_TRIBE_INSECT,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_MIGHT,
      battle.ABILITY_GROUP_HEAL,
    ]
  },
  // battle.UNIT_TRIBE_ORC
  {
    template: 25,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_HEAVY_ARROW,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 26,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RAGE,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 27,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_RUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 28,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_RUSH,
      battle.ABILITY_RETRIBUTION,
    ]
  },
  {
    template: 29,
    unitTribe: battle.UNIT_TRIBE_ORC,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
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
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 31,
    unitTribe: battle.UNIT_TRIBE_ASSEMBLING,
    unitClass: battle.UNIT_CLASS_MAGE,
    abilities: [
      battle.ABILITY_FLAME_STRIKE,
      battle.ABILITY_ENERGY_BOLT,
      battle.ABILITY_DARK_VORTEX,
    ]
  },
  {
    template: 32,
    unitTribe: battle.UNIT_TRIBE_ASSEMBLING,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_STUN,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 33,
    unitTribe: battle.UNIT_TRIBE_ASSEMBLING,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_RUSH,
      battle.ABILITY_RETRIBUTION,
    ]
  },
  {
    template: 34,
    unitTribe: battle.UNIT_TRIBE_ASSEMBLING,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
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
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_STUN,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 36,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FURY_CLAWS,
      battle.ABILITY_BLADE_VORTEX,
    ]
  },
  {
    template: 37,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 38,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 39,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_CURSE,
      battle.ABILITY_MIGHT,
      battle.ABILITY_GROUP_HEAL,
    ]
  },
  // battle.UNIT_TRIBE_SKELETON
  {
    template: 40,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_ARROW_CRUSH,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 41,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 42,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_DRAGON_BITE,
      battle.ABILITY_FLIGHT,
      battle.ABILITY_DRAGON_FURY,
    ]
  },
  {
    template: 43,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_HEAVY_STRIKE,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 44,
    unitTribe: battle.UNIT_TRIBE_SKELETON,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_WEAKNESS,
      battle.ABILITY_LAZINESS,
    ]
  },
    // battle.UNIT_TRIBE_CLOCKWORK
  {
    template: 35,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_STUN,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 36,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FURY_CLAWS,
      battle.ABILITY_BLADE_VORTEX,
    ]
  },
  {
    template: 37,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 38,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 39,
    unitTribe: battle.UNIT_TRIBE_CLOCKWORK,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_CURSE,
      battle.ABILITY_MIGHT,
      battle.ABILITY_GROUP_HEAL,
    ]
  },
  // battle.UNIT_TRIBE_ICE
  {
    template: 40,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RAGE,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 41,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FROST_BLADE,
      battle.ABILITY_FROZEN_ABYSS,
    ]
  },
  {
    template: 42,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_SPEAR_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_FATAL_STRIKE,
    ]
  },
  {
    template: 43,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_TELEPORTATION,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 44,
    unitTribe: battle.UNIT_TRIBE_ICE,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_MIGHT,
      battle.ABILITY_LAZINESS,
    ]
  },
  // battle.UNIT_TRIBE_ELF
  {
    template: 45,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_DOUBLE_SHOT,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 46,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 47,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 48,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_RUSH,
      battle.ABILITY_RETRIBUTION,
    ]
  },
  {
    template: 49,
    unitTribe: battle.UNIT_TRIBE_ELF,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_MIGHT,
      battle.ABILITY_GROUP_HEAL,
    ]
  },
  // battle.UNIT_TRIBE_ELDRITCH
  {
    template: 50,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_DOUBLE_SHOT,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 51,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_STRONG_PUNCH,
      battle.ABILITY_FURY_CLAWS,
      battle.ABILITY_BLADE_VORTEX,
    ]
  },
  {
    template: 52,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_STUN,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 53,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_TELEPORTATION,
      battle.ABILITY_SHIELD_STUN,
    ]
  },
  {
    template: 54,
    unitTribe: battle.UNIT_TRIBE_ELDRITCH,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_WEAKNESS,
      battle.ABILITY_LAZINESS,
    ]
  },
  // battle.UNIT_TRIBE_FALLEN_KING
  {
    template: 55,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_HAMSTRING,
    ]
  },
  {
    template: 56,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_AXE_BLOW,
      battle.ABILITY_ZEALOT,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 57,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_SWORD_CRUSH,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 58,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_HEAVY_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_HUMMER_BLOW,
    ]
  },
  {
    template: 59,
    unitTribe: battle.UNIT_TRIBE_FALLEN_KING,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_WEAKNESS,
      battle.ABILITY_WIND_WALK,
    ]
  },
  // battle.UNIT_TRIBE_LEGENDARY
  {
    template: 60,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_MAGE,
    abilities: [
      battle.ABILITY_FLAME_STRIKE,
      battle.ABILITY_HURRICANE,
      battle.ABILITY_DARK_VORTEX,
    ]
  },
  {
    template: 61,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_RUSH,
      battle.ABILITY_LETHAL_STRIKE,
    ]
  },
  {
    template: 62,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_KUNAI_STRIKE,
      battle.ABILITY_BLADE_VORTEX,
    ]
  },
  {
    template: 63,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_AGRESSION,
      battle.ABILITY_SHIELD_STRIKE,
      battle.ABILITY_SHIELD_WALL,
    ]
  },
  {
    template: 64,
    unitTribe: battle.UNIT_TRIBE_LEGENDARY,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_SHIELD,
      battle.ABILITY_MIGHT,
      battle.ABILITY_LAZINESS,
    ]
  },
  // battle.UNIT_TRIBE_TITAN
  {
    template: 65,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_RANGE,
    abilities: [
      battle.ABILITY_POWER_SHOT,
      battle.ABILITY_STUN_SHOT,
      battle.ABILITY_DEATH_SHOT,
    ]
  },
  {
    template: 66,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FIRE_BLADE,
      battle.ABILITY_CRUSH_OF_DOOM,
    ]
  },
  {
    template: 67,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_MELEE,
    abilities: [
      battle.ABILITY_POWER_STRIKE,
      battle.ABILITY_FROST_BLADE,
      battle.ABILITY_FROZEN_ABYSS,
    ]
  },
  {
    template: 68,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_TANK,
    abilities: [
      battle.ABILITY_HOLY_STRIKE,
      battle.ABILITY_FLIGHT,
      battle.ABILITY_RETRIBUTION,
    ]
  },
  {
    template: 69,
    unitTribe: battle.UNIT_TRIBE_TITAN,
    unitClass: battle.UNIT_CLASS_SUPPORT,
    abilities: [
      battle.ABILITY_HEAL,
      battle.ABILITY_MIGHT,
      battle.ABILITY_WIND_WALK,
    ]
  },
];

/*
  hp: number;
  damage: number;
  defence: number;
  initiative: number;
  speed: number;
*/

export const SQUAD_BONUSES = {
  [battle.UNIT_TRIBE_KOBOLD]: [
    // Tier 1
    [
      // Attack +5%
      { index: "damage", modifier: 5 },
      { index: "damage", modifier: 7 },
      { index: "damage", modifier: 10 },
      { index: "damage", modifier: 15 },
    ],
    // Tier 2
    [
      // Swamp slows down by 25% less
      { index: "swamp_speed", modifier: 25 },
      { index: "swamp_speed", modifier: 50 },
      { index: "swamp_speed", modifier: 75 },
      { index: "swamp_speed", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { index: "defence_stack", modifier: 1, max: 5 },
      { index: "defence_stack", modifier: 1, max: 7 },
      { index: "defence_stack", modifier: 1, max: 10 },
      { index: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_DWARF]: [
    // Tier 1
    [
      // Attack +5%
      { index: "hp", modifier: 5 },
      { index: "hp", modifier: 7 },
      { index: "hp", modifier: 10 },
      { index: "hp", modifier: 15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { index: "hill_attack", modifier: 25 },
      { index: "hill_attack", modifier: 50 },
      { index: "hill_attack", modifier: 75 },
      { index: "hill_attack", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { index: "defence_stack", modifier: 1, max: 5 },
      { index: "defence_stack", modifier: 1, max: 7 },
      { index: "defence_stack", modifier: 1, max: 10 },
      { index: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_EGYPTIAN]: [
    // Tier 1
    [
      // Attack +5%
      { index: "damage", modifier: 5 },
      { index: "damage", modifier: 7 },
      { index: "damage", modifier: 10 },
      { index: "damage", modifier: 15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { index: "woods_defence", modifier: 25 },
      { index: "woods_defence", modifier: 50 },
      { index: "woods_defence", modifier: 75 },
      { index: "woods_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { index: "counter_attack", probability: 7 },
      { index: "counter_attack", probability: 10 },
      { index: "counter_attack", probability: 12 },
      { index: "counter_attack", probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_GOBLIN]: [
    // Tier 1
    [
      // HP +5%
      { index: "hp", modifier: 5 },
      { index: "hp", modifier: 7 },
      { index: "hp", modifier: 10 },
      { index: "hp", modifier: 15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { index: "woods_defence", modifier: 25 },
      { index: "woods_defence", modifier: 50 },
      { index: "woods_defence", modifier: 75 },
      { index: "woods_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by 5%
      { index: "debuff_speed", modifier: 5 },
      { index: "debuff_speed", modifier: 7 },
      { index: "debuff_speed", modifier: 10 },
      { index: "debuff_speed", modifier: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_INSECT]: [
    // Tier 1
    [
      // Defense +5%
      { index: "defence", modifier: 5 },
      { index: "defence", modifier: 7 },
      { index: "defence", modifier: 10 },
      { index: "defence", modifier: 15 },
    ],
    // Tier 2
    [
      // Swamp slows down by 25% less
      { index: "swamp_speed", modifier: 25 },
      { index: "swamp_speed", modifier: 50 },
      { index: "swamp_speed", modifier: 75 },
      { index: "swamp_speed", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { index: "defence_stack", modifier: 1, max: 5 },
      { index: "defence_stack", modifier: 1, max: 7 },
      { index: "defence_stack", modifier: 1, max: 10 },
      { index: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ORC]: [
    // Tier 1
    [
      // Attack +5%
      { index: "damage", modifier: 5 },
      { index: "damage", modifier: 7 },
      { index: "damage", modifier: 10 },
      { index: "damage", modifier: 15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { index: "hill_attack", modifier: 25 },
      { index: "hill_attack", modifier: 50 },
      { index: "hill_attack", modifier: 75 },
      { index: "hill_attack", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { index: "defence_stack", modifier: 1, max: 5 },
      { index: "defence_stack", modifier: 1, max: 7 },
      { index: "defence_stack", modifier: 1, max: 10 },
      { index: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ASSEMBLING]: [
    // Tier 1
    [
      // Abilities power +5%
      { index: "abilities", modifier: 5 },
      { index: "abilities", modifier: 7 },
      { index: "abilities", modifier: 10 },
      { index: "abilities", modifier: 15 },
    ],
    // Tier 2
    [
      // Swamp slows down by 25% less
      { index: "swamp_speed", modifier: 25 },
      { index: "swamp_speed", modifier: 50 },
      { index: "swamp_speed", modifier: 75 },
      { index: "swamp_speed", modifier: 100 },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { index: "crit", modifier: 1.3, probability: 7 },
      { index: "crit", modifier: 1.5, probability: 10 },
      { index: "crit", modifier: 1.7, probability: 12 },
      { index: "crit", modifier: 2, probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ICE]: [
    // Tier 1
    [
      // Defense +5%
      { index: "defence", modifier: 5 },
      { index: "defence", modifier: 7 },
      { index: "defence", modifier: 10 },
      { index: "defence", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { index: "ice_defence", modifier: 25 },
      { index: "ice_defence", modifier: 50 },
      { index: "ice_defence", modifier: 75 },
      { index: "ice_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by 5%
      { index: "debuff_speed", modifier: 5 },
      { index: "debuff_speed", modifier: 7 },
      { index: "debuff_speed", modifier: 10 },
      { index: "debuff_speed", modifier: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_CLOCKWORK]: [
    // Tier 1
    [
      // Defense +5%
      { index: "defence", modifier: 5 },
      { index: "defence", modifier: 7 },
      { index: "defence", modifier: 10 },
      { index: "defence", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { index: "lava_damage", modifier: -25 },
      { index: "lava_damage", modifier: -50 },
      { index: "lava_damage", modifier: -75 },
      { index: "lava_damage", modifier: -100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { index: "defence_stack", modifier: 1, max: 5 },
      { index: "defence_stack", modifier: 1, max: 7 },
      { index: "defence_stack", modifier: 1, max: 10 },
      { index: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ELDRITCH]: [
    // Tier 1
    [
      // Defense +5%
      { index: "hp", modifier: 5 },
      { index: "hp", modifier: 7 },
      { index: "hp", modifier: 10 },
      { index: "hp", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { index: "lava_damage", modifier: -25 },
      { index: "lava_damage", modifier: -50 },
      { index: "lava_damage", modifier: -75 },
      { index: "lava_damage", modifier: -100 },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { index: "crit", modifier: 1.3, probability: 7 },
      { index: "crit", modifier: 1.5, probability: 10 },
      { index: "crit", modifier: 1.7, probability: 12 },
      { index: "crit", modifier: 2, probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_ELF]: [
    // Tier 1
    [
      // Abilities power +5%
      { index: "abilities", modifier: 5 },
      { index: "abilities", modifier: 7 },
      { index: "abilities", modifier: 10 },
      { index: "abilities", modifier: 15 },
    ],
    // Tier 2
    [
      // Defense in the woods is 25% higher
      { index: "woods_defence", modifier: 25 },
      { index: "woods_defence", modifier: 50 },
      { index: "woods_defence", modifier: 75 },
      { index: "woods_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // Chance of a counterattack 7%
      { index: "counter_attack", probability: 7 },
      { index: "counter_attack", probability: 10 },
      { index: "counter_attack", probability: 12 },
      { index: "counter_attack", probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_SKELETON]: [
    // Tier 1
    [
      // Abilities power +5%
      { index: "hp", modifier: 5 },
      { index: "hp", modifier: 7 },
      { index: "hp", modifier: 10 },
      { index: "hp", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { index: "ice_defence", modifier: 25 },
      { index: "ice_defence", modifier: 50 },
      { index: "ice_defence", modifier: 75 },
      { index: "ice_defence", modifier: 100 },
    ],
    // Tier 3
    [
      // When a squad member takes damage the squad's defense is increased by 1% (max. 5%)
      { index: "defence_stack", modifier: 1, max: 5 },
      { index: "defence_stack", modifier: 1, max: 7 },
      { index: "defence_stack", modifier: 1, max: 10 },
      { index: "defence_stack", modifier: 1, max: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_FALLEN_KING]: [
    // Tier 1
    [
      // Attack +5%
      { index: "damage", modifier: 5 },
      { index: "damage", modifier: 7 },
      { index: "damage", modifier: 10 },
      { index: "damage", modifier: 15 },
    ],
    // Tier 2
    [
      // Attack on hills is 25% higher
      { index: "hill_attack", modifier: 25 },
      { index: "hill_attack", modifier: 50 },
      { index: "hill_attack", modifier: 75 },
      { index: "hill_attack", modifier: 100 },
    ],
    // Tier 3
    [
      // Chance to deal a critical hit 7% (damage x1.3)
      { index: "crit", modifier: 1.3, probability: 7 },
      { index: "crit", modifier: 1.5, probability: 10 },
      { index: "crit", modifier: 1.7, probability: 12 },
      { index: "crit", modifier: 2, probability: 15 },
    ],
  ],
  [battle.UNIT_TRIBE_TITAN]: [
    // Tier 1
    [
      // Abilities power +5%
      { index: "abilities", modifier: 5 },
      { index: "abilities", modifier: 7 },
      { index: "abilities", modifier: 10 },
      { index: "abilities", modifier: 15 },
    ],
    // Tier 2
    [
      // Ice defense reduction is 25% weaker
      { index: "lava_damage", modifier: -25 },
      { index: "lava_damage", modifier: -50 },
      { index: "lava_damage", modifier: -75 },
      { index: "lava_damage", modifier: -100 },
    ],
    // Tier 3
    [
      // When a unit is debuffed, their speed is increased by 5%
      { index: "debuff_speed", modifier: 5 },
      { index: "debuff_speed", modifier: 7 },
      { index: "debuff_speed", modifier: 10 },
      { index: "debuff_speed", modifier: 15 },
    ],
  ],
};