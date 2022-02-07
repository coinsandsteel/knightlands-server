import { UNIT_CLASS_PET } from "../../../knightlands-shared/march";
import { HpClass } from "../other/HpClass";
import { StepInterface } from "../other/StepInterface";
import { v4 as uuidv4 } from "uuid";

/*
{ 
  _id: "dc8c4aefc000"
  class: 'pet',
  hp: 5
  armor: 0
  petClass: 1,
  level: 1,
  penaltySteps: 0
}
*/

export class Pet extends HpClass implements StepInterface {
  protected _id: string;

  private maxHp: number;
  private armor: number = 0;
  private penaltySteps: number = 0;

  private petClass: number = 1;
  private level: number = 1;

  protected class = UNIT_CLASS_PET;

  constructor(petClass: number, level: number) {
    super();
    this._id = uuidv4().split('-').slice(-1);
    this.maxHp = this.hp;
    this.petClass = petClass;
    this.level = level;
  }

  protected setInitialHP(): void {
    // ???
  }

  public userStepCallback(): void {
    this.penaltySteps--;
    if (this.penaltySteps <= 0) {
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
    this.penaltySteps = steps;
  }
}