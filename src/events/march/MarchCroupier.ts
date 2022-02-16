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

  public getContainerLoot(container: Container, opened: boolean): Unit {
    const unitClasses = march.UNIT_LOOT[container.unitClass + (opened ? '+' : '-')];
    const unitClass = unitClasses[Random.intRange(0, unitClasses.length - 1)];
    const hp = null;
    const loot = this._map.makeUnit({ _id: null, unitClass, hp: hp || container.hp });
    return loot;
  }
}