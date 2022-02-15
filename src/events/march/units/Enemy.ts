import { Unit } from "../other/UnitClass";
import { Loot } from "../units/Loot";
import * as march from "../../../knightlands-shared/march";
import { MarchCard } from "../types";

export class Enemy extends Unit {
  public touch(){
    this.activate();
  }  
  
  public activate(){
    if (this.unitClass === march.UNIT_CLASS_TRAP) {
      if (this.opened) {
        this.map.enablePenalty(this.hp);
      }
    } else {
      this.fight();
    }
  }  

  private fight(): void {
    const pet = this.map.pet;
    pet.handleDamage(this.hp);

    if (pet.isDead()) {
      this.map.exit();
    } else {
      if (this.unitClass === march.UNIT_CLASS_ENEMY_BOSS) {
        pet.upgradeHP(1);
        this.map.croupier.upgradePool();
      }
      this.map.addGold(this.hp);
    }
  }

  public replaceWithGold(): void {
    // TODO sync bossesKilled stat
    const newUnit = new Loot({
      unitClass: march.UNIT_CLASS_GOLD,
      hp: this.maxHp,
    } as MarchCard, this.map);
    
    this.map.replaceCellWith(this, newUnit);
  }

  public destroy(): void { 
    this.replaceWithGold();
  };

  public userStepCallback(): void {
    if (this.unitClass === march.UNIT_CLASS_TRAP) {
      this.setOpened(!this.opened);
    }
  };
}