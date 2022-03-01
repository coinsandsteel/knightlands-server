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

    if (!(this.unitClass === march.UNIT_CLASS_TRAP && !this.opened)) {
      pet.handleDamage(this.hp);
    }

    if (pet.isDead()) {
      return;
    }

    if (this.unitClass === march.UNIT_CLASS_ENEMY_BOSS) {
      pet.upgradeHP(1);
      this.bossKilled();
    }

    if (this.unitClass === march.UNIT_CLASS_TRAP && this.opened) {
      this.map.enablePenalty(this.hp);
    }

    this.map.marchUser.addSessionGold(this.hp);
  }

  public replaceWithGold(): void {
    const newUnit = new Loot({
      unitClass: march.UNIT_CLASS_GOLD,
      hp: this.maxHp,
    } as MarchCard, this.map);
    
    this.map.replaceCellWith(this, newUnit);
  }

  public destroy(): void {
    if (this.unitClass === march.UNIT_CLASS_ENEMY_BOSS) {
      this.map.bossKilled();
    }
    this.replaceWithGold();
  };

  public userStepCallback(): void {
    if (this.unitClass === march.UNIT_CLASS_TRAP) {
      this.setOpened(!this.opened);
    }
  };

  protected bossKilled(): void {
    this.map.bossKilled();
    this.map.croupier.upgradePool();
  }
}