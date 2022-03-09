 import { Unit } from "../other/UnitClass";
import { Loot } from "../units/Loot";
import * as march from "../../../knightlands-shared/march";
import { MarchCard } from "../types";

export class Artifact extends Unit {
  public userStepCallback() {
    if (this.unitClass === march.UNIT_CLASS_BOMB) {
      this._timer--;
      this.map.events.bombTimer(this.serialize(), this.index);
      if (this._timer <= 0) {
        this.activate();
      }
    }
  }
 
  public touch() {
    if (this.unitClass === march.UNIT_CLASS_BOMB) {
      // swap positions
      this.map.swapPetCellTo(this);
    } else {
      this.activate();
    }
  };

  public activate() {
    let direction = null;
    switch (this.unitClass) {
      case march.UNIT_CLASS_BALL_LIGHTNING: {
        direction = march.DIRECTION_RANDOM5;
        break;
      }
      case march.UNIT_CLASS_DRAGON_BREATH: {
        direction = march.DIRECTION_ALL;
        break;
      }
      case march.UNIT_CLASS_BOMB:
      case march.UNIT_CLASS_BOW: {
        direction = march.DIRECTION_CROSS;
        break;
      }
    }

    this.map.handleDamage(this, direction);

    if (this.unitClass === march.UNIT_CLASS_BOMB) {
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

  public destroy(): void { 
    this.replaceWithGold();
  };
}