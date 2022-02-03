import { Unit } from "../other/UnitClass";
import * as march from "../../../knightlands-shared/march";

export class Loot extends Unit {
  public touch() {
    this.activate();
  };

  public activate(): void {
    switch (this.type) {
      case march.UNIT_TYPE_HP: {
        this.map.pet.modifyHp(this.hp);
        break;
      }
      case march.UNIT_TYPE_EXTRA_HP: {
        this.map.pet.upgradeHP(this.hp);
        break;
      }
      case march.UNIT_TYPE_ARMOR: {
        this.map.pet.modifyArmor(this.hp);
        break;
      }
      case march.UNIT_TYPE_GOLD: {
        // TODO
        break;
      }
    }
  }
}