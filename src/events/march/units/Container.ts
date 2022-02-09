import { Unit } from "../other/UnitClass";
import { UNIT_CLASS_BARRELL, UNIT_CLASS_CHEST } from "../../../knightlands-shared/march";
import { Loot } from "./Loot";
import * as march from "../../../knightlands-shared/march";

export class Container extends Unit {
  protected opened: boolean = false;
  private _keyNumber: number;
  
  public touch(): void {
    this.activate();
  };

  public activate(): void {
    if (this.unitClass === UNIT_CLASS_BARRELL) {
      this.replaceWithLoot();
    }
    if (this.unitClass === UNIT_CLASS_CHEST) {
      this.map.launchMiniGame(this);
    }
  }

  public replaceWithLoot(): void {
    // TODO rules
    const loot = new Loot(this.map);
    this.map.replaceCellWith(this, loot);
  }

  public replaceWithGold(): void {
    const gold = new Loot(this.map);
    gold.setUnitClass(march.UNIT_CLASS_GOLD);
    this.map.replaceCellWith(this, gold);
  }

  public setRandomKeyNumber(): void {
    this._keyNumber = 1;
  }

  public tryToOpen(keyNumber: number): boolean {
    return this._keyNumber === keyNumber;
  }
}