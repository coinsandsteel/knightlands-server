import Random from "../../../random";
import { Unit } from "../other/UnitClass";
import { StepInterface } from "../other/StepInterface";
import { PetState } from "../types";
import { BOOSTER_KEY, BOOSTER_LIFE } from "../../../knightlands-shared/march";

/*
Pet class #3. 
III level Extra life at the start of the session

Pet class #4. 
II level +20% extra Gold per session

Pet class #5. 
II level HP can exceed the maximum, but if the maximum is exceeded, then the booster does not have an effect
III level Turns armor into ball lightning
*/

export class Pet extends Unit implements StepInterface {
  protected _armor: number = 0;
  protected _petClass: number;
  protected _level: number;

  public setAttributes(state: PetState): void {
    this._petClass = state.petClass;
    this._level = state.level;
    this._armor = state.armor;
  }

  get armor(): number {
    return this._armor;
  }

  get serial(): string {
    return `C${this._petClass}L${this._level}`;
  }

  protected serializeState(): PetState {
    return {
      petClass: this._petClass,
      level: this._level,
      armor: this._armor
    };
  }

  public handleDamage(value): void {
    if (value > this._armor) {
      this.modifyHp(-(value - this._armor));
    }
    this.modifyArmor(-value);
  };

  public upgradeHP(value): void {
    this.modifyHp(value);
    this.modifyMaxHP(value);
  };

  public modifyMaxHP(value): void {
    this._maxHp += value;
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
    const hpBonus = this.serial === 'C3L1' ? 1 : 0;
    this._armor = 0;
    this._maxHp = 10 + hpBonus;
    this.restoreHealth();
  };

  public restoreHealth(): void {
    this._hp = this._maxHp;
  }

  public modifyHp(value: number): void {
    if (value < 0 && this.serial === 'C3L2') {
      value += Random.intRange(0, 1);
    }
    this._hp += value;
    if (this._hp <= 0) {
      this.destroy();
    }
  };
  
  public activate(): void { return; };
  public touch(): void { return; };
  public destroy(): void { 
    this.map.modifyPreGameBooster(BOOSTER_KEY, -1);
    this.map.modifyPreGameBooster(BOOSTER_LIFE, -1);
  };
  public userStepCallback(): void { return; };
}