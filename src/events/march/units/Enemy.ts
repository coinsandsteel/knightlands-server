import { Unit } from "../other/UnitClass";
import { Loot } from "../units/Loot";
import * as march from "../../../knightlands-shared/march";
import { MarchCard } from "../types";

export class Enemy extends Unit {
  public touch(){
    this.activate();
  }  
  
  public activate(){
    this.fight();
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
      if (this.unitClass === march.UNIT_CLASS_TRAP && this.opened) {
        this.map.enablePenalty(this.hp);
      }
      this.map.marchUser.addSessionGold(this.hp);
    }
  }

  public replaceWithGold(): void {
    const newUnit = new Loot({
      unitClass: march.UNIT_CLASS_GOLD,
      hp: this.maxHp,
    } as MarchCard, this.map);
    
    this.map.replaceCellWith(this, newUnit);
    this.map.bossKilled();
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