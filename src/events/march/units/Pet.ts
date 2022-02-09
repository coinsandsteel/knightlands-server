import { UNIT_CLASS_PET } from "../../../knightlands-shared/march";
import { Unit } from "../other/UnitClass";
import { MarchMap } from "../MarchMap";
import { StepInterface } from "../other/StepInterface";
import { v4 as uuidv4 } from "uuid";
import { PetState } from "../types";

export class Pet extends Unit implements StepInterface {
  protected _id: string;

  private _maxHp: number;
  private _armor: number = 0;
  
  protected _unitClass = UNIT_CLASS_PET;
  protected _petClass: number;
  protected _level: number;

  constructor(unitClass: string, initialHp: number, map: MarchMap, _id: string|null) {
    super(unitClass, initialHp, map, _id);
    this._id = _id || uuidv4().split('-').pop();
    this._hp = initialHp;
  }

  public setAttributes(state: PetState): void {
    this._maxHp = state.maxHp || this.hp;
    this._petClass = state.petClass;
    this._level = state.level;
    this._armor = state.armor;
  }

  get armor(): number {
    return this._armor;
  }

  protected serializeState(): PetState {
    return {
      maxHp: this._maxHp,
      petClass: this._petClass,
      level: this._level,
      armor: this._armor
    };
  }

  public handleDamage(value): void {
    this.modifyArmor(-value);

    if (value > this._armor) {
      value -= this._armor;
      this.modifyHp(-value);
    }
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
  };

  public restoreHealth(): void {
    this._hp = this._maxHp;
  }

  public activate(): void { return; };
  public touch(): void { return; };
  public destroy(): void { return; };
  public userStepCallback(): void { return; };
}