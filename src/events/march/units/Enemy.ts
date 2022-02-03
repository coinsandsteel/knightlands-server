import { Unit } from "../other/UnitClass";
import * as march from "../../../knightlands-shared/march";

export class Enemy extends Unit {
  public touch(){
    this.activate();
  }  
  
  public activate(){
    if (this.type === march.UNIT_TYPE_TRAP) {
      this.map.pet.enablePenalty(this.tier);
      this.destroy();
      this.map.movePetTo(this.index);
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
      this.map.movePetTo(this.index);
    }
  }

  public replaceWithLoot(): void {
    // TODO rules
    const loot = new Unit(this.map);
    this.map.replaceCellWith(this.index, loot);
  }
}