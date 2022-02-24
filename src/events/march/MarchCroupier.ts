import Random from "../../random";
import { MarchMap } from "./MarchMap";
import { Unit } from "./other/UnitClass";
import { MarchCard } from "./types";
import { Container } from "./units/Container";
import { 
  UNIT_CLASS_ENEMY,
  UNIT_CLASS_ENEMY_BOSS,
  UNIT_CLASS_TRAP,
  UNIT_CLASS_HP,
  UNIT_CLASS_ARMOR,
  UNIT_CLASS_BOW,
  UNIT_CLASS_BARREL,
  UNIT_CLASS_GOLD,
  UNIT_CLASS_CHEST,
  UNIT_CLASS_EXTRA_HP,
  UNIT_CLASS_BALL_LIGHTNING,
  UNIT_CLASS_DRAGON_BREATH,
  UNIT_CLASS_BOMB,
} from "../../knightlands-shared/march";

export const UNIT_PROBABILITIES = {
  [UNIT_CLASS_ENEMY]: 0.37,
  [UNIT_CLASS_TRAP]: 0.074,
  [UNIT_CLASS_HP]: 0.37 / 3,
  [UNIT_CLASS_ARMOR]: 0.37 / 3,
  [UNIT_CLASS_BOW]: 0.37 / 3,
  [UNIT_CLASS_BARREL]: 0.111,
  [UNIT_CLASS_GOLD]: 0.074
}

export const UNIT_POOL = [
  {
    stepsToBoss: 10,
    unitStat: {
      // Enemies
      [UNIT_CLASS_ENEMY]: { min: 1, max: 4 },
      // Traps
      [UNIT_CLASS_TRAP]: { min: 1, max: 1 },
      // Boosters - hp, armor, bow
      [UNIT_CLASS_HP]: { min: 1, max: 3 },
      [UNIT_CLASS_ARMOR]: { min: 1, max: 3 },
      [UNIT_CLASS_BOW]: { min: 1, max: 3 },
      // Gold
      [UNIT_CLASS_GOLD]: { min: 1, max: 3 },
      // Barrel
      [UNIT_CLASS_BARREL]: { min: 2, max: 2 },
      // Boss
      [UNIT_CLASS_ENEMY_BOSS]: { min: 10, max: 10 },
    }
  },
  {
    stepsToBoss: 11,
    unitStat: {
      // Enemies
      [UNIT_CLASS_ENEMY]: { min: 1, max: 5 },
      // Traps
      [UNIT_CLASS_TRAP]: { min: 1, max: 2 },
      // Boosters - hp, armor, bow
      [UNIT_CLASS_HP]: { min: 1, max: 4 },
      [UNIT_CLASS_ARMOR]: { min: 1, max: 4 },
      [UNIT_CLASS_BOW]: { min: 1, max: 4 },
      // Gold
      [UNIT_CLASS_GOLD]: { min: 1, max: 4 },
      // Barrel
      [UNIT_CLASS_BARREL]: { min: 2, max: 2 },
      // Boss
      [UNIT_CLASS_ENEMY_BOSS]: { min: 12, max: 12 },
    }
  },
  {
    stepsToBoss: 12,
    unitStat: {
      // Enemies
      [UNIT_CLASS_ENEMY]: { min: 1, max: 6 },
      // Traps
      [UNIT_CLASS_TRAP]: { min: 1, max: 2 },
      // Boosters - hp, armor, bow
      [UNIT_CLASS_HP]: { min: 1, max: 4 },
      [UNIT_CLASS_ARMOR]: { min: 1, max: 4 },
      [UNIT_CLASS_BOW]: { min: 1, max: 4 },
      // Gold
      [UNIT_CLASS_GOLD]: { min: 1, max: 5 },
      // Barrel
      [UNIT_CLASS_BARREL]: { min: 2, max: 3 },
      // Boss
      [UNIT_CLASS_ENEMY_BOSS]: { min: 14, max: 14 },
    }
  },
  {
    stepsToBoss: 13,
    unitStat: {
      // Enemies
      [UNIT_CLASS_ENEMY]: { min: 1, max: 7 },
      // Traps
      [UNIT_CLASS_TRAP]: { min: 1, max: 3 },
      // Boosters - hp, armor, bow
      [UNIT_CLASS_HP]: { min: 1, max: 5 },
      [UNIT_CLASS_ARMOR]: { min: 1, max: 5 },
      [UNIT_CLASS_BOW]: { min: 1, max: 5 },
      // Gold
      [UNIT_CLASS_GOLD]: { min: 1, max: 6 },
      // Barrel
      [UNIT_CLASS_BARREL]: { min: 2, max: 3 },
      // Boss
      [UNIT_CLASS_ENEMY_BOSS]: { min: 18, max: 18 },
    }
  },
  {
    stepsToBoss: 10,
    unitStat: {
      // Enemies
      [UNIT_CLASS_ENEMY]: { min: 1, max: 8 },
      // Traps
      [UNIT_CLASS_TRAP]: { min: 1, max: 3 },
      // Boosters - hp, armor, bow
      [UNIT_CLASS_HP]: { min: 1, max: 5 },
      [UNIT_CLASS_ARMOR]: { min: 1, max: 5 },
      [UNIT_CLASS_BOW]: { min: 1, max: 5 },
      // Gold
      [UNIT_CLASS_GOLD]: { min: 1, max: 7 },
      // Barrel
      [UNIT_CLASS_BARREL]: { min: 2, max: 3 },
      // Boss
      [UNIT_CLASS_ENEMY_BOSS]: { min: 22, max: 22 },
    }
  },
  {
    stepsToBoss: 14,
    unitStat: {
      // Enemies
      [UNIT_CLASS_ENEMY]: { min: 1, max: 9 },
      // Traps
      [UNIT_CLASS_TRAP]: { min: 1, max: 5 },
      // Boosters - hp, armor, bow
      [UNIT_CLASS_HP]: { min: 1, max: 6 },
      [UNIT_CLASS_ARMOR]: { min: 1, max: 6 },
      [UNIT_CLASS_BOW]: { min: 1, max: 6 },
      // Gold
      [UNIT_CLASS_GOLD]: { min: 1, max: 8 },
      // Barrel
      [UNIT_CLASS_BARREL]: { min: 2, max: 4 },
      // Boss
      [UNIT_CLASS_ENEMY_BOSS]: { min: 26, max: 26 },
    }
  },
  {
    stepsToBoss: 15,
    unitStat: {
      // Enemies
      [UNIT_CLASS_ENEMY]: { min: 1, max: 10 },
      // Traps
      [UNIT_CLASS_TRAP]: { min: 1, max: 5 },
      // Boosters - hp, armor, bow
      [UNIT_CLASS_HP]: { min: 1, max: 6 },
      [UNIT_CLASS_ARMOR]: { min: 1, max: 6 },
      [UNIT_CLASS_BOW]: { min: 1, max: 6 },
      // Gold
      [UNIT_CLASS_GOLD]: { min: 1, max: 9 },
      // Barrel
      [UNIT_CLASS_BARREL]: { min: 2, max: 4 },
      // Boss
      [UNIT_CLASS_ENEMY_BOSS]: { min: 30, max: 30 },
    }
  },
]

export const UNIT_LOOT = {
  [UNIT_CLASS_BARREL + '-']: [
    UNIT_CLASS_ARMOR,
    UNIT_CLASS_HP,
    UNIT_CLASS_BOW,
    UNIT_CLASS_ENEMY,
  ],
  [UNIT_CLASS_BARREL + '+']: [
    UNIT_CLASS_ARMOR,
    UNIT_CLASS_HP,
    UNIT_CLASS_BOW
  ],
  [UNIT_CLASS_CHEST + '-']: [
    UNIT_CLASS_ENEMY,
    UNIT_CLASS_TRAP,
    UNIT_CLASS_ARMOR,
    UNIT_CLASS_HP,
    UNIT_CLASS_BOW,
  ],
  [UNIT_CLASS_CHEST + '+']: [
    UNIT_CLASS_EXTRA_HP,
    UNIT_CLASS_BALL_LIGHTNING,
    UNIT_CLASS_DRAGON_BREATH,
    UNIT_CLASS_BOMB,
  ],
};


export class MarchCroupier {
  protected _map: MarchMap;
  protected _poolNumber: number;
  protected _stepCounter: number;
  protected _queue: string[];

  constructor(map: MarchMap) {
    this._map = map;
    this._poolNumber = 0;
    this._stepCounter = 0;
    this._queue = [];
  }

  get pool() {
    return UNIT_POOL[this._poolNumber];
  }

  get stepsToNextBoss(): number {
    const steps = this.pool.stepsToBoss - this._stepCounter;
    return steps < 0 ? 0 : steps;
  }

  public getCard(returnBlueprint?: boolean): Unit|MarchCard {
    let unitClass = UNIT_CLASS_GOLD;

    if (this._queue.length) {
      unitClass = this._queue.shift();
    } else {
      unitClass = this.getUnitClassByProbability();
    }

    if (
      this._map.pet.checkClassAndLevel(5, 3)
      &&
      unitClass === UNIT_CLASS_ARMOR
    ) {
      unitClass = UNIT_CLASS_BALL_LIGHTNING;
    }

    let hp = 0;
    if (
      [
        UNIT_CLASS_EXTRA_HP,
        UNIT_CLASS_DRAGON_BREATH
      ].includes(unitClass)
    ) {
      hp = 0;
    } else {
      hp = Random.intRange(
        this.pool.unitStat[unitClass] ? this.pool.unitStat[unitClass].min : 1,
        this.pool.unitStat[unitClass] ? this.pool.unitStat[unitClass].max : 5
      );
    }
    
    let blueprint = { _id: null, unitClass, hp, opened: null };
    if (unitClass === UNIT_CLASS_TRAP) {
      blueprint.opened = Random.intRange(0, 1);
    }

    if (returnBlueprint) {
      return blueprint;
    } else {
      return this._map.makeUnit(blueprint);
    }
  }

  public getUnitClassByProbability(): string {
    // Source:
    // https://gist.github.com/alesmenzel/6164543b3d018df7bcaf6c5f9e6a841e
    const unitClasses =  Object.keys(UNIT_PROBABILITIES);
    const find = input => unitClasses.find((el, i) => {
      const sum = unitClasses.slice(0, i + 1).reduce((acc, el) => {
        return acc + UNIT_PROBABILITIES[el];
      }, 0);
      if (input < sum) {
        return true;
      }
      return false;
    });  
    return find(Random.range(0, 1));
  }

  public increaseStepCounter(): void {
    this._stepCounter++;
    if (this._stepCounter == this.pool.stepsToBoss) {
      this._queue.push(UNIT_CLASS_ENEMY_BOSS);
    }
  }

  public reset(): void {
    this._queue = [];
    this._poolNumber = 0;
    this.resetStepCounter();
  }

  protected resetStepCounter(): void {
    this._stepCounter = 0;
  }

  public upgradePool(): void {
    this.resetStepCounter();
    if (this._poolNumber >= UNIT_POOL.length - 1) {
      return;
    }
    this._poolNumber++;
    this._queue.push(UNIT_CLASS_CHEST);
  }

  public getContainerLoot(container: Container, positive: boolean): Unit {
    const unitClasses = UNIT_LOOT[container.unitClass + (positive ? '+' : '-')];
    let unitClass = unitClasses[Random.intRange(0, unitClasses.length - 1)];
    
    if (
      this._map.pet.checkClassAndLevel(5, 3)
      &&
      unitClass === UNIT_CLASS_ARMOR
    ) {
      unitClass = UNIT_CLASS_BALL_LIGHTNING;
    }
    
    let hp = container.hp;
    if ([
      UNIT_CLASS_EXTRA_HP, 
      UNIT_CLASS_DRAGON_BREATH
    ].includes(unitClass)) {
      hp = 0;
    }
    const loot = this._map.makeUnit({ _id: null, unitClass, hp });
    return loot;
  }
}