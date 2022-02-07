import { Unit } from "../other/UnitClass";
import { MarchMap } from "../MarchMap";
import * as march from "../../../knightlands-shared/march";

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

  public activate() {
    let hpModifier = null;
    let direction = null;
    switch (this.unitClass) {
      case march.UNIT_CLASS_BALL_LIGHTNING: {
        direction = "random5";
        hpModifier = -this.hp;
        break;
      }
      case march.UNIT_CLASS_DRAGON_BREATH: {
        direction = "all";
        hpModifier = -1000;
        break;
      }
      case march.UNIT_CLASS_BOMB: {
        direction = "cross";
        hpModifier = -1000;
        break;
      }
      case march.UNIT_CLASS_BOW: {
        hpModifier = this.hp;
        direction = "crossBow";
        break;
      }
    }
    this.map.modifyHP(this, hpModifier, direction);
  };
}