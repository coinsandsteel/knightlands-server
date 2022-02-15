import Random from "../../random";
import { MarchMap } from "./MarchMap";
import { Unit } from "./other/UnitClass";
import * as march from "../../knightlands-shared/march";
import { MarchCard } from "./types";

export class MarchCroupier {
  protected _map: MarchMap;
  protected _poolNumber: number;
  protected _stepCounter: number;

  constructor(map: MarchMap) {
    this._map = map;
    this._poolNumber = 0;
    this._stepCounter = 0;
  }

  get pool() {
    return march.UNIT_POOL[this._poolNumber];
  }

  get bossSummonAllowed(): boolean {
    return this._stepCounter == this.pool.stepsToBoss;
  }

  get stepsToNextBoss(): number {
    const steps = this.pool.stepsToBoss - this._stepCounter;
    return steps < 0 ? 0 : steps;
  }

  public getCard(returnBlueprint?: boolean): Unit|MarchCard {
    let unitClass = march.UNIT_CLASS_GOLD;

    if (!this.bossSummonAllowed) {
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
      unitClass = find(Random.range(0, 1));
    } else {
      unitClass = march.UNIT_CLASS_ENEMY_BOSS;
    }

    console.log("Card choosed", { unitClass });

    const hp = Random.intRange(
      this.pool.unitStat[unitClass].min,
      this.pool.unitStat[unitClass].max
    );
    const blueprint = { _id: null, unitClass, hp };

    if (returnBlueprint) {
      return blueprint;
    } else {
      return this._map.makeUnit(blueprint);
    }
  }

  public increaseStepCounter(): void {
    this._stepCounter++;
  }

  protected resetStepCounter(): void {
    this._stepCounter = 0;
  }

  public upgradePool(): void {
    if (this._poolNumber >= march.UNIT_POOL.length) {
      return;
    }
    this._poolNumber++;
    this.resetStepCounter();
  }

  public getCardForBarrel(barrelHp: number): Unit {
    /*
    const random = Random.intRange(0, 3);
    march.UNIT_CLASS_ARMOR
    march.UNIT_CLASS_HP
    march.UNIT_CLASS_BOW
    march.UNIT_CLASS_ENEMY
    */
    return this._map.makeUnit({ _id: null, unitClass: march.UNIT_CLASS_GOLD, hp: 1 });
  }

  public getCardForOpenedChest(): Unit {
    /*
    const random = Random.intRange(0, 3);
    march.UNIT_CLASS_EXTRA_HP
    march.UNIT_CLASS_BALL_LIGHTNING
    march.UNIT_CLASS_DRAGON_BREATH
    march.UNIT_CLASS_BOMB
    */
    return this._map.makeUnit({ _id: null, unitClass: march.UNIT_CLASS_GOLD, hp: 1 });
  }

  public getCardForDestructedChest(): Unit {
    /*  
    const random = Random.intRange(0, 4);
    march.UNIT_CLASS_ENEMY
    march.UNIT_CLASS_ARMOR
    march.UNIT_CLASS_HP
    march.UNIT_CLASS_BOW
    march.UNIT_CLASS_TRAP
    */
    return this._map.makeUnit({ _id: null, unitClass: march.UNIT_CLASS_GOLD, hp: 1 });
  }
}