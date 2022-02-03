import { Unit } from "../other/UnitClass";
import { UNIT_TYPE_BARRELL, UNIT_TYPE_CHEST } from "../../../knightlands-shared/march";

export class Container extends Unit {
  private _keyNumber: number;

  public touch(): void {
    this.activate();
  };

  public activate(): void {
    if (this.type === UNIT_TYPE_BARRELL) {
      this.replaceWithLoot();
    }
    if (this.type === UNIT_TYPE_CHEST) {
      this.map.launchMiniGame(this);
    }
  }

  public replaceWithLoot(): void {
    // TODO rules
    const loot = new Unit(this.map);
    this.map.replaceCellWith(this.index, loot);
  }

  public setRandomKeyNumber(): void {
    this._keyNumber = 1;
  }

  public tryToOpen(keyNumber: number): boolean {
    return this._keyNumber === keyNumber;
  }
}