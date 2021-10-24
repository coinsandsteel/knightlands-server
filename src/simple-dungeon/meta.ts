import { DungeonMeta } from "./types";

const enemiesById = {
  1: { id: 1, name: "Goblin-Archer", difficulty: 1 },
  2: { id: 2, name: "Halloween-Bat", difficulty: 1 },
  3: { id: 3, name: "Halloween-Lick-O-Wisp", difficulty: 1 },
  4: { id: 4, name: "Halloween-Pumpkin-Chariot-Minion-A", difficulty: 1 },
  5: { id: 5, name: "Halloween-Spirit-Mumpkin", difficulty: 1 },
  6: { id: 6, name: "Halloween-Stein-Monster", difficulty: 1 },
  7: { id: 7, name: "Zombie-Forest-Flower", difficulty: 1 },

  8: { id: 8, name: "Egypt-Mummy-A", difficulty: 2 },
  9: { id: 9, name: "Halloween-Black-Cat", difficulty: 2 },
  10: { id: 10, name: "Halloween-Pumpkin-Chariot-Minion-B", difficulty: 2 },
  11: { id: 11, name: "Hunter-Pet-Crow", difficulty: 2 },
  12: { id: 12, name: "Library-Book-Swarm", difficulty: 2 },
  13: { id: 13, name: "Mountain-Black-Wolf", difficulty: 2 },
  14: { id: 14, name: "Zombie-Goblin-Grunt", difficulty: 2 },

  15: { id: 15, name: "Colossal-Dark-Crow", difficulty: 3 },
  16: { id: 16, name: "Egypt-Mummy-B", difficulty: 3 },
  17: { id: 17, name: "Halloween-Dagger-skeleton", difficulty: 3 },
  18: { id: 18, name: "Halloween-Pumpkin-Gentleman", difficulty: 3 },
  19: { id: 19, name: "Halloween-Stein's-Monster-MK2", difficulty: 3 },
  20: { id: 20, name: "Mimic-Book", difficulty: 3 },
  21: { id: 21, name: "Plant-Warriors-Rose-Knight", difficulty: 3 },

  22: { id: 22, name: "Desert-Cactus-Triple", difficulty: 4 },
  23: { id: 23, name: "Halloween-Pumpkin-Chariot", difficulty: 4 },
  24: { id: 24, name: "Megapack-III-Undead-Warrior-Benkei", difficulty: 4 },
  25: { id: 25, name: "Mimic", difficulty: 4 },
  26: { id: 26, name: "Mountain-Bat", difficulty: 4 },
  27: { id: 27, name: "Seven-Sins-Envy", difficulty: 4 },
  28: { id: 28, name: "Skeleton-Warriors-Bandit", difficulty: 4 },

  29: { id: 29, name: "Colossal-Bat", difficulty: 5 },
  30: { id: 30, name: "Dryads-Warrior", difficulty: 5 },
  31: { id: 31, name: "Eldritch-Corrruption-Toucan", difficulty: 5 },
  32: { id: 32, name: "Halloween-Pumpkin", difficulty: 5 },
  33: { id: 33, name: "Halloween-Vampire", difficulty: 5 },
  34: { id: 34, name: "Halloween-Witch", difficulty: 5 },
  35: { id: 35, name: "Library-Book-Master", difficulty: 5 },

  36: { id: 36, name: "Aspiring-Knight-Palazo", difficulty: 6 },
  37: { id: 37, name: "Boss-Insect-Queen", difficulty: 6 },
  38: { id: 38, name: "Boss-Lich-King", difficulty: 6 },
  39: { id: 39, name: "DnD-Boar-Gorilla", difficulty: 6 },
  40: { id: 40, name: "Halloween-Witch-Baba", difficulty: 6 },
  41: { id: 41, name: "Insects-Swarm", difficulty: 6 },
  42: { id: 42, name: "Secondary-Elementals-Acid-Elemental", difficulty: 6 },
};

const enemiesByDifficulty = {
  1: Object.values(enemiesById).filter(i => i.difficulty === 1 ),
  2: Object.values(enemiesById).filter(i => i.difficulty === 2 ),
  3: Object.values(enemiesById).filter(i => i.difficulty === 3 ),
  4: Object.values(enemiesById).filter(i => i.difficulty === 4 ),
  5: Object.values(enemiesById).filter(i => i.difficulty === 5 ),
  6: Object.values(enemiesById).filter(i => i.difficulty === 6 )
}

const meta: DungeonMeta = {
  enemies: {
    enemiesById,
    enemiesByDifficulty
  },
  mode: {
      duration: 900,
      maxFloor: 5,
      floorsPerDay: 5,
      maxEnergy: 10,
      refillsPerDay: 10,
      energyRefillCost: 10
  },
  dungeons: {
    floors: [
      {
        width: 6,
        height: 9,
        extraPassageChance: 15,
        missedPassageChanceInc: 5,
        enemies: [{ difficulty: 1, count: 25 }, { difficulty: 2, count: 15 }],
        loot: [{ items: { id: 1 }}]
      },
      {
        width: 6,
        height: 9,
        extraPassageChance: 15,
        missedPassageChanceInc: 5,
        enemies: [{ difficulty: 1, count: 25 }, { difficulty: 2, count: 15 }],
        loot: [{ items: { id: 1 }}]
      },
    ]
  }
};

export default meta;