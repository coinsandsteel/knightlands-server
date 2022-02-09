import { Unit } from "../other/UnitClass";
import { Loot } from "../units/Loot";
import { UNIT_CLASS_BARRELL, UNIT_CLASS_CHEST, UNIT_CLASS_GOLD } from "../../../knightlands-shared/march";

export class Container extends Unit {
  protected _opened: boolean = false;
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
    // TODO implement
    //const loot = new Loot(class, this.map);
    //this.map.replaceCellWith(this, loot);
  }

  public setRandomKeyNumber(): void {
    this._keyNumber = 1;
  }

  public tryToOpen(keyNumber: number): boolean {
    return this._keyNumber === keyNumber;
  }

  public replaceWithGold(): void {
    const newUnit = new Loot(UNIT_CLASS_GOLD, this.hp, this.map);
    this.map.replaceCellWith(this, newUnit);
  }

  public destroy(): void { 
    this.replaceWithGold();
  };
}