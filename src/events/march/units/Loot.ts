import { Unit } from "../other/UnitClass";
import * as march from "../../../knightlands-shared/march";
import { MarchCard } from "../types";

export class Loot extends Unit {
  public touch() {
    this.activate();
  };

  public activate(): void {
    switch (this.unitClass) {
      case march.UNIT_CLASS_HP: {
        this.map.pet.modifyHp(
          this.hp + (this.map.pet.serial === 'C1L2' ? 1 : 0)
        );
        break;
      }
      case march.UNIT_CLASS_EXTRA_HP: {
        this.map.pet.upgradeHP(1);
        break;
      }
      case march.UNIT_CLASS_ARMOR: {
        this.map.pet.replaceArmor(
          this.hp + (this.map.pet.serial === 'C1L3' ? 1 : 0)
        );
        break;
      }
      case march.UNIT_CLASS_GOLD: {
        this.map.addGold(
          this.hp + (this.map.pet.serial === 'C4L1' ? 1 : 0)
        );
        break;
      }
    }
  }

  public destroy(): void { 
    if (this.unitClass !== march.UNIT_CLASS_GOLD) {
      this.replaceWithGold();
    }
  };

  public replaceWithGold(): void {
    const newUnit = new Loot({
      unitClass: march.UNIT_CLASS_GOLD,
      hp: this.maxHp,
    } as MarchCard, this.map);

    this.map.replaceCellWith(this, newUnit);
  }
}