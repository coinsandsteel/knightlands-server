import { HpClass } from "../other/HpClass";
import { StepInterface } from "../other/StepInterface";

export class Pet extends HpClass implements StepInterface {
  private maxHp: number;
  private armor: number;
  private tier: number;
  private level: number;
  private penalty: boolean;
  private penaltySteps: number;
  
  constructor(tier: number, level: number) {
    super();
    this.maxHp = this.hp;
    this.armor = 0;
    this.penaltySteps = 0;
    this.tier = tier;
    this.level = level;
  }

  protected setInitialHP(): void {
    // ???
  }

  public userStepCallback(): void {
    this.penaltySteps--;
    if (this.penaltySteps <= 0) {
      this.penalty = false;
      this.penaltySteps = 0;
    }
  };

  public handleDamage(value): void {
    this.modifyArmor(-value);

    if (value > this.armor) {
      value -= this.armor;
      this.modifyHp(-value);
    }
  };

  public upgradeHP(value): void {
    this.modifyHp(value);
    this.modifyMaxHP(value);
  };

  public modifyMaxHP(value): void {
    this.maxHp += value;
  };
  
  public modifyArmor(value): void {
    this.armor += value;
    if (this.armor <= 0) {
      this.armor = 0;
    }
  };

  public restoreHealth(): void {
    this.hp = this.maxHp;
  }

  public enablePenalty(steps): void {
    this.penalty = true;
    this.penaltySteps = steps;
  }
}