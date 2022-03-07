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
        const bonus = this.map.pet.checkClassAndLevel(1, 2);
        if (bonus) {
          //console.log(`[Pet C1/L2] PASSED. Hp heal bonus +1.`);
        } else {
          //console.log(`[Pet C1/L2] FAILED. Hp heal bonus +0.`);
        }
        this.map.pet.modifyHp(
          this.hp + (bonus ? 1 : 0)
        );
        break;
      }
      case march.UNIT_CLASS_EXTRA_HP: {
        this.map.pet.upgradeHP(1);
        break;
      }
      case march.UNIT_CLASS_ARMOR: {
        const bonus = this.map.pet.checkClassAndLevel(1, 3);
        if (bonus) {
          //console.log(`[Pet C1/L3] PASSED. Armor heal bonus +1.`);
        } else {
          //console.log(`[Pet C1/L3] FAILED. Armor heal bonus +0.`);
        }
        this.map.pet.replaceArmor(
          this.hp + (bonus ? 1 : 0)
        );
        break;
      }
      case march.UNIT_CLASS_GOLD: {
        const bonus = this.map.pet.checkClassAndLevel(4, 1);
        if (bonus) {
          //console.log(`[Pet C4/L1] PASSED. Gold card bonus +1.`);
        } else {
          //console.log(`[Pet C4/L1] FAILED. Gold card bonus +0.`);
        }
        this.map.marchUser.addSessionGold(
          this.hp + (bonus ? 1 : 0)
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