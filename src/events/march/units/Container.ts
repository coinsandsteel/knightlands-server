import { Unit } from "../other/UnitClass";
import { UNIT_CLASS_BARRELL, UNIT_CLASS_CHEST } from "../../../knightlands-shared/march";
import { MarchMap } from "../MarchMap";

export class Container extends Unit {
  private opened: boolean;
  private _keyNumber: number;

  constructor(map: MarchMap) {
    super(map);
    this.opened = false;
  }
  
  public touch(): void {
    this.activate();
  };

  public activate(): void {
    if (this.class === UNIT_CLASS_BARRELL) {
      this.replaceWithLoot();
    }
    if (this.class === UNIT_CLASS_CHEST) {
      this.map.launchMiniGame(this);
    }
  }

  public replaceWithLoot(): void {
    // TODO rules
    const loot = new Unit(this.map);
    this.map.replaceCellWith(this, loot);
  }

  public setRandomKeyNumber(): void {
    this._keyNumber = 1;
  }

  public tryToOpen(keyNumber: number): boolean {
    return this._keyNumber === keyNumber;
  }
}