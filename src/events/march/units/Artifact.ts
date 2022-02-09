import { Unit } from "../other/UnitClass";
import { MarchMap } from "../MarchMap";
import * as march from "../../../knightlands-shared/march";
import { Loot } from "./Loot";

export class Artifact extends Unit {
  public userStepCallback() {
    if (this.unitClass === march.UNIT_CLASS_BOMB) {
      this.hp--;
      if (this.hp <= 0) {
        this.activate();
      }
    }
  }

  public touch() {
    if (this.unitClass === march.UNIT_CLASS_BOMB) {
      // swap positions
      this.map.swapPetCellTo(this);
    }
  };

  public replaceWithGold(): void {
    const gold = new Loot(this.map);
    gold.setUnitClass(march.UNIT_CLASS_GOLD);
    this.map.replaceCellWith(this, gold);
  }

  public activate() {
    let amount = null;
    let direction = null;
    switch (this.unitClass) {
      case march.UNIT_CLASS_BALL_LIGHTNING: {
        direction = march.DIRECTION_RANDOM5;
        amount = -this.hp;
        break;
      }
      case march.UNIT_CLASS_DRAGON_BREATH: {
        direction = march.DIRECTION_ALL;
        amount = -1000;
        break;
      }
      case march.UNIT_CLASS_BOMB: {
        direction = march.DIRECTION_CROSS;
        amount = -this.initialHp;
        break;
      }
      case march.UNIT_CLASS_BOW: {
        direction = march.DIRECTION_CROSS;
        amount = this.hp;
        break;
      }
    }
    this.map.handleScriptDamage(this, amount, direction);
  };
}