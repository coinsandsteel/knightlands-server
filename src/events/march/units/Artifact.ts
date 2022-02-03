import { Unit } from "../other/UnitClass";
import { MarchMap } from "../MarchMap";
import * as march from "../../../knightlands-shared/march";

export class Artifact extends Unit {
  public userStepCallback() {
    if (this.type === march.UNIT_TYPE_BOMB) {
      this.hp--;
      if (this.hp <= 0) {
        this.activate();
      }
    }
  }

  public touch() {
    if (this.type === march.UNIT_TYPE_BOMB) {
      // swap positions
      this.map.swapPetCellTo(this.index);
    }
  };

  public activate() {
    let hpModifier = null;
    let direction = null;
    switch (this.type) {
      case march.UNIT_TYPE_BALL_LIGHTNING: {
        direction = "random5";
        hpModifier = -this.hp;
        // Animation event?
        break;
      }
      case march.UNIT_TYPE_DRAGON_BREATH: {
        direction = "all";
        hpModifier = -1000;
        // Animation event?
        break;
      }
      case march.UNIT_TYPE_BOMB: {
        direction = "cross";
        hpModifier = -1000;
        // Animation event?
        break;
      }
      case march.UNIT_TYPE_REINFORCER: {
        direction = "round";
        hpModifier = 2;
        // Animation event?
        break;
      }
      case march.UNIT_TYPE_BOW: {
        hpModifier = this.hp;
        direction = "crossBow";
        // Animation event?
        break;
      }
    }
    this.map.modifyHP(this.index, hpModifier, direction);
  };
}