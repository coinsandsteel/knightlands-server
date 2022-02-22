import Random from "../../random";
import { MarchMap } from "./MarchMap";
import { Unit } from "./other/UnitClass";
import * as march from "../../knightlands-shared/march";
import { MarchCard } from "./types";
import { Container } from "./units/Container";

export class MarchCroupier {
  protected _map: MarchMap;
  protected _poolNumber: number;
  protected _stepCounter: number;
  protected _queue: string[];

  constructor(map: MarchMap) {
    this._map = map;
    this._poolNumber = 0;
    this._stepCounter = 0;
    this._queue = [
      march.UNIT_CLASS_EXTRA_HP,
      march.UNIT_CLASS_CHEST,
      march.UNIT_CLASS_BALL_LIGHTNING,
      march.UNIT_CLASS_DRAGON_BREATH,
      march.UNIT_CLASS_BOMB,
      march.UNIT_CLASS_HP,
      march.UNIT_CLASS_BOW,
      march.UNIT_CLASS_ENEMY,
      march.UNIT_CLASS_ENEMY,
      march.UNIT_CLASS_BOW,
      march.UNIT_CLASS_ENEMY,
      march.UNIT_CLASS_ENEMY,
      march.UNIT_CLASS_TRAP,
      march.UNIT_CLASS_ARMOR,
      march.UNIT_CLASS_BOMB,
      march.UNIT_CLASS_HP,
      march.UNIT_CLASS_ARMOR,
      march.UNIT_CLASS_BOW,
    ];
  }

  get pool() {
    return march.UNIT_POOL[this._poolNumber];
  }

  get stepsToNextBoss(): number {
    const steps = this.pool.stepsToBoss - this._stepCounter;
    return steps < 0 ? 0 : steps;
  }

  public getCard(returnBlueprint?: boolean): Unit|MarchCard {
    let unitClass = march.UNIT_CLASS_GOLD;

    if (this._queue.length) {
      unitClass = this._queue.shift();
    } else {
      unitClass = this.getUnitClassByProbability();
    }

    if (
      this._map.pet.checkClassAndLevel(5, 3)
      &&
      unitClass === march.UNIT_CLASS_ARMOR
    ) {
      unitClass = march.UNIT_CLASS_BALL_LIGHTNING;
    }

    let hp = 0;
    if (
      [
        march.UNIT_CLASS_EXTRA_HP,
        march.UNIT_CLASS_DRAGON_BREATH
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
    if (unitClass === march.UNIT_CLASS_TRAP) {
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
    const unitClasses =  Object.keys(march.UNIT_PROBABILITIES);
    const find = input => unitClasses.find((el, i) => {
      const sum = unitClasses.slice(0, i + 1).reduce((acc, el) => {
        return acc + march.UNIT_PROBABILITIES[el];
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
      this._queue.push(march.UNIT_CLASS_ENEMY_BOSS);
    }
  }

  protected resetStepCounter(): void {
    this._stepCounter = 0;
  }

  public upgradePool(): void {
    if (this._poolNumber >= march.UNIT_POOL.length) {
      return;
    }
    this._queue.push(march.UNIT_CLASS_CHEST);
    this._poolNumber++;
    this.resetStepCounter();
  }

  public getContainerLoot(container: Container, positive: boolean): Unit {
    const unitClasses = march.UNIT_LOOT[container.unitClass + (positive ? '+' : '-')];
    let unitClass = unitClasses[Random.intRange(0, unitClasses.length - 1)];
    
    if (
      this._map.pet.checkClassAndLevel(5, 3)
      &&
      unitClass === march.UNIT_CLASS_ARMOR
    ) {
      unitClass = march.UNIT_CLASS_BALL_LIGHTNING;
    }
    
    let hp = container.hp;
    if ([
      march.UNIT_CLASS_EXTRA_HP, 
      march.UNIT_CLASS_DRAGON_BREATH
    ].includes(unitClass)) {
      hp = 0;
    }
    const loot = this._map.makeUnit({ _id: null, unitClass, hp });
    return loot;
  }
}