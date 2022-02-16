import { Unit } from "../other/UnitClass";
import { Loot } from "../units/Loot";
import { BOOSTER_KEY, UNIT_CLASS_BARREL, UNIT_CLASS_CHEST, UNIT_CLASS_ENEMY, UNIT_CLASS_GOLD } from "../../../knightlands-shared/march";
import { MarchCard } from "../types";
import random from "../../../random";

export class Container extends Unit {
  protected _opened: boolean = false;
  private _keyNumber: number;

  get keyNumber(): number {
    return this._keyNumber;
  }
  
  public touch(): void {
    this.activate();
  };

  public activate(): void {
    if (this.unitClass === UNIT_CLASS_BARREL) {
      this.open(true);
    }
    if (this.unitClass === UNIT_CLASS_CHEST) {
      if(this.map.canUsePreGameBooster(BOOSTER_KEY)) {
        this.open(true);
      } else {
        this.map.launchMiniGame(this);
      }
    }
  }

  public open(success: boolean): void {
    const loot = this.map.croupier.getContainerLoot(this, success);
    this.map.replaceCellWith(this, loot);
  }

  public tryToOpenChest(key: number): void {
    const result = this._keyNumber == key;
    this.open(result);
    this.map.events.miniGameResult(result);
  }

  public setRandomKeyNumber(): void {
    this._keyNumber = random.intRange(0, 2);
  }

  public replaceWithGold(): void {
    const newUnit = new Loot({
      unitClass: UNIT_CLASS_GOLD,
      hp: this.maxHp,
    } as MarchCard, this.map);

    this.map.replaceCellWith(this, newUnit);
  }

  public replaceWithEnemy(): void {
    const newUnit = new Loot({
      unitClass: UNIT_CLASS_ENEMY,
      hp: this.maxHp,
    } as MarchCard, this.map);

    this.map.replaceCellWith(this, newUnit);
  }

  public destroy(): void { 
    this.replaceWithGold();
  };
}