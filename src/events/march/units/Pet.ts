import Random from "../../../random";
import { Unit } from "../other/UnitClass";
import { StepInterface } from "../other/StepInterface";
import { PetState } from "../types";
import * as march from "../../../knightlands-shared/march";

/*
Pet class #1. 
I no abilities.
II Heath booster value +1
III level Armor booster value +1

Pet class #2. 
I level Bow damage +1
II level When two bows are stacked +2 damage 
III level Bomb explosion does no damage

Pet class #3. 
I level MaxHP +1
II level 50% Chance to Block 1 Damage
III level Extra life at the start of the session

Pet class #4. 
I level gold +1 from gold card
II level +20% extra Gold per session
III level Chest opens without mini-game

Pet class #5. 
I level All barrels have only good content.
II HP booster increases HP over maxHp one time.
III level Turns armor into ball lightning
*/

export class Pet extends Unit implements StepInterface {
  protected _extraLife: number = 0;
  protected _armor: number = 0;
  protected _petClass: number;
  protected _level: number;

  public setAttributes(state: PetState): void {
    this._petClass = state.petClass;
    this._level = state.level;
    this._armor = state.armor;
  }

  get petClass(): number {
    return this._petClass;
  }

  get armor(): number {
    return this._armor;
  }

  protected serializeState(): PetState {
    return {
      petClass: this._petClass,
      level: this._level,
      armor: this._armor
    };
  }

  public checkClassAndLevel(petClass: number, level: number): boolean {
    return this._petClass === petClass && this._level >= level;
  }

  public handleDamage(value): void {
    if (value > this._armor) {
      this.modifyHp(-(value - this._armor));
    }
    this.modifyArmor(-value);
  };

  public upgradeHP(value): void {
    this.modifyMaxHP(value);
    this.modifyHp(value);
  };

  public modifyMaxHP(value): void {
    this._maxHp += value;
    this.map.events.cardHp(this.serialize(), this.index);
  };
  
  public modifyArmor(value): void {
    this._armor += value;
    if (this._armor <= 0) {
      this._armor = 0;
    }
    this.map.events.petArmor(this._armor);
  };
  
  public replaceArmor(value): void {
    if (value <= this._armor) {
      return;
    }
    this._armor = value;
    this.map.events.petArmor(value);
  };

  public reset(): void {
    const hpBonus = this.checkClassAndLevel(3, 1) ? 1 : 0;
    if (hpBonus) {
      console.log('[Pet C3/L1] PASSED. MaxHP +1');
    } else {
      console.log('[Pet C3/L1] FAILED. MaxHP +0');
    }

    const extraLifeBonus = this.checkClassAndLevel(3, 3) ? 1 : 0;
    if (extraLifeBonus) {
      console.log('[Pet C3/L3] PASSED. Extra life +1');
    } else {
      console.log('[Pet C3/L3] FAILED. Extra life +0');
    }
    
    this._armor = 0;
    this._extraLife = extraLifeBonus;
    this._maxHp = 10 + hpBonus;
    this.restoreHealth();
  };

  public restoreHealth(): void {
    this._hp = this._maxHp;
  }
  
  public modifyHp(hpModifier: number): void {
    const blockingDamage = this.map.pet.checkClassAndLevel(3, 2);
    if (hpModifier < 0) {
      if (blockingDamage) {
        console.log(`[Pet C3/L2] PASSED. There's 50% chance to block 1 damage.`);
      } else {
        console.log(`[Pet C3/L2] FAILED. There's 0% chance to block 1 damage.`);
      }
    }

    if (hpModifier < 0 && blockingDamage) {
      const damageBlocked = Random.intRange(0, 1);
      console.log(`[Pet C3/L2] PASSED. ${damageBlocked} damage blocked.`);
      hpModifier += damageBlocked;
    }
    
    const hpOveflowBonus = this.checkClassAndLevel(5, 2);
    if (hpOveflowBonus) {
      console.log(`[Pet C5/L2] PASSED. HP overflow bonus is working.`);
    } else {
      console.log(`[Pet C5/L2] FAILED. HP overflow bonus is not working.`);
    }
  
    if (hpOveflowBonus && hpModifier > 0 && this._hp <= this._maxHp) {
        const oldHp = this._hp;
        this._hp += hpModifier;
        console.log(`[Pet C5/L2] PASSED. HP overflow bonus activated HP: ${oldHp} + ${hpModifier} = ${this._hp}.`);
    } else {
      this._hp += hpModifier;
      if (this._hp > this._maxHp) {
        this._hp = this._maxHp;
      }
    }


    if (this.isDead()) {
      if (this.map.marchUser.canUsePreGameBooster(march.BOOSTER_LIFE)) {
        this._hp = this.maxHp;
        this.map.marchUser.modifyPreGameBooster(march.BOOSTER_LIFE, -1);
      } else if (this._extraLife) {
        this._hp = this.maxHp;
        this._extraLife = 0;
      } else {
        this.destroy();
      }
    }

    if (hpModifier) {
      this.map.events.cardHp(this.serialize(), this.index);
    }
  };
  
  public activate(): void { return; };
  public touch(): void { return; };
  public destroy(): void { 
    this.map.gameOver();
  };
  public userStepCallback(): void { return; };
}