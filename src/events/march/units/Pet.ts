import { UNIT_CLASS_PET } from "../../../knightlands-shared/march";
import { Unit } from "../other/UnitClass";
import { MarchMap } from "../MarchMap";
import { StepInterface } from "../other/StepInterface";
import { v4 as uuidv4 } from "uuid";
import { PetState } from "../types";

/*
{ 
  _id: "dc8c4aefc000"
  unitClass: 'pet',
  hp: 5
  armor: 0
  petClass: 1,
  level: 1,
  penaltySteps: 0
}
*/

export class Pet extends Unit {
  protected _id: string;

  private maxHp: number;
  private armor: number = 0;
  
  protected unitClass = UNIT_CLASS_PET;
  protected petClass: number;
  protected level: number;

  constructor(map: MarchMap, petClass: number, level: number, armor: number) {
    super(map);
    
    this._id = uuidv4().split('-').pop();
    this.maxHp = this.hp;

    this.petClass = petClass;
    this.level = level;
    this.armor = armor;
  }

  protected serializeState(): PetState {
    return {
      petClass: this.petClass,
      level: this.level,
      armor: this.armor
    };
  }

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

  public setUnitClass(unitClass: string): void { return; };
  public activate(): void { return; };
  public touch(): void { return; };
  public destroy(): void { return; };
}