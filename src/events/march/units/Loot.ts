import { Unit } from "../other/UnitClass";
import * as march from "../../../knightlands-shared/march";

export class Loot extends Unit {
  public touch() {
    this.activate();
  };

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
        this.map.addGold(this.hp);
        break;
      }
    }
    this.map.movePetTo(this);
  }

  public destroy(): void { 
    if (this.unitClass !== march.UNIT_CLASS_GOLD) {
      this.replaceWithGold();
    }
  };

  public replaceWithGold(): void {
    const newUnit = new Loot(march.UNIT_CLASS_GOLD, this.hp, this.map);
    this.map.replaceCellWith(this, newUnit);
  }
}