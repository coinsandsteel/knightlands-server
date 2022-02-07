import { Unit } from "../other/UnitClass";
import * as march from "../../../knightlands-shared/march";

export class Enemy extends Unit {
  public touch(){
    this.activate();
  }  
  
  public activate(){
    if (this.unitClass === march.UNIT_CLASS_TRAP) {
      this.map.enablePenalty(this.hp);
      this.destroy();
      this.map.movePetTo(this);
    } else {
      this.fight();
    }
  }  

  private fight(): void {
    const pet = this.map.pet;
    const initialEnemyHp = this.hp;
    pet.handleDamage(this.hp);
    if (pet.isDead()) {
      this.map.exit();
    } else {
      pet.restoreHealth();
      this.replaceWithLoot();
      this.map.addGold(initialEnemyHp);
      this.map.movePetTo(this);
    }
  }

  public replaceWithLoot(): void {
    // TODO rules
    const loot = new Unit(this.map);
    this.map.replaceCellWith(this, loot);
  }
}