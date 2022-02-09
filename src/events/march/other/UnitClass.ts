import { MarchMap } from "../MarchMap";
import { HpClass } from "./HpClass";
import { StepInterface } from "./StepInterface";
import { v4 as uuidv4 } from "uuid";
import { MarchCard } from "../types";
import * as march from "../../../knightlands-shared/march";

export class Unit extends HpClass implements StepInterface {
  protected _id: string;
  protected _map: MarchMap;
  protected _unitClass: string;
  protected _opened: boolean|null = null;

  get map(): MarchMap {
    return this._map;
  }

  get id(): string {
    return this._id;
  }

  get opened(): boolean|null {
    return this._opened;
  }

  get unitClass(): string {
    return this._unitClass;
  }

  get isEnemy(): boolean {
    return this.unitClass === march.UNIT_CLASS_ENEMY || this.unitClass === march.UNIT_CLASS_ENEMY_BOSS || this.unitClass === march.UNIT_CLASS_TRAP;
  };

  get isPet(): boolean {
    return this.unitClass === march.UNIT_CLASS_PET;
  };
  
  constructor(card: MarchCard, map: MarchMap) {
    super();
    
    this._map = map;
    this._unitClass = card.unitClass;
    this._hp = card.hp;
    this._maxHp = card.maxHp || card.hp;
    this._id = card._id || uuidv4().split('-').pop();

    if (card.opened !== null) {
      this._opened = card.opened;
    }
  }

  public setOpened(opened: boolean): void {
    this._opened = opened;
  };

  public activate(): void {};
  public touch(): void {};
  public userStepCallback(): void {};

  public serialize(): MarchCard {
    const card = {
      _id: this._id,
      hp: this._hp,
      maxHp: this._maxHp,
      unitClass: this.unitClass
    } as MarchCard;

    if (this.opened !== null) {
      card.opened = this.opened;
    }
    
    return card;
  };

  public modifyHp(hpModifier: number): void {
    this._hp += hpModifier;
    if (this.isDead()) {
      this.destroy();
    }
  };
}