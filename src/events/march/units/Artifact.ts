import { Unit } from "../other/UnitClass";
import { Loot } from "../units/Loot";
import * as march from "../../../knightlands-shared/march";

export class Artifact extends Unit {
  public userStepCallback() {
    if (this.unitClass === march.UNIT_CLASS_BOMB) {
      this.modifyHp(-1);
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

  public activate() {
    let hpModifier = null;
    let direction = null;
    switch (this.unitClass) {
      case march.UNIT_CLASS_BALL_LIGHTNING: {
        direction = march.DIRECTION_RANDOM5;
        hpModifier = -this.hp;
        break;
      }
      case march.UNIT_CLASS_DRAGON_BREATH: {
        direction = march.DIRECTION_ALL;
        hpModifier = 0;
        break;
      }
      case march.UNIT_CLASS_BOMB:
      case march.UNIT_CLASS_BOW: {
        direction = march.DIRECTION_CROSS;
        // TODO initialHp or hp?
        hpModifier = -this.hp;
        break;
      }
    }
    this.map.handleScriptDamage(this, hpModifier, direction);
    this.destroy();
  };

  public replaceWithGold(): void {
    const newUnit = new Loot(march.UNIT_CLASS_GOLD, this.hp, this.map);
    this.map.replaceCellWith(this, newUnit);
  }

  public destroy(): void { 
    this.replaceWithGold();
  };
}