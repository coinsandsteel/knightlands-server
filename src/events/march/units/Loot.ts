import { Unit } from "../other/UnitClass";
import * as march from "../../../knightlands-shared/march";

export class Loot extends Unit {
  public touch() {
    this.activate();
  };

  public replaceWithGold(): void {
    const gold = new Loot(this.map);
    gold.setUnitClass(march.UNIT_CLASS_GOLD);
    this.map.replaceCellWith(this, gold);
  }

  public activate(): void {
    switch (this.unitClass) {
      case march.UNIT_CLASS_HP: {
        this.map.pet.modifyHp(this.hp);
        break;
      }
      case march.UNIT_CLASS_EXTRA_HP: {
        this.map.pet.upgradeHP(this.hp);
        break;
      }
      case march.UNIT_CLASS_ARMOR: {
        this.map.pet.modifyArmor(this.hp);
        break;
      }
      case march.UNIT_CLASS_GOLD: {
        // TODO
        break;
      }
    }
  }
}