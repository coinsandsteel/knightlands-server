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
  protected _capturedIndex: number|null = null;

  get map(): MarchMap {
    return this._map;
  }

  get id(): string {
    return this._id;
  }

  get index(): number {
    return this._capturedIndex !== null ? this._capturedIndex : this.map.getIndexOfCard(this);
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

    if (this.unitClass === march.UNIT_CLASS_TRAP) {
      this._opened = card.opened;
    }
  }

  public captureIndex(): void {
    this._capturedIndex = this.index;
  };

  public setOpened(opened: boolean): void {
    this._opened = opened;
    this.map.events.trapOpened(this.serialize(), this.index);
  };

  public activate(): void {};
  public touch(): void {};
  public userStepCallback(): void {};

  public serialize(): MarchCard {
    const card = {
      _id: this._id,
      hp: this._hp,
      maxHp: this._maxHp,
      previousHp: this._previousHp,
      unitClass: this.unitClass
    } as MarchCard;

    if (this.opened !== null) {
      card.opened = this.opened;
    }
    
    return card;
  };

  public modifyHp(hpModifier: number): void {
    this._hp += hpModifier;
    
    if (
      this.unitClass !== march.UNIT_CLASS_BOW
      &&
      this._hp > this._maxHp
    ) {
      this._hp = this._maxHp;
    }

    if (this.isDead()) {
      this.destroy();
    }

    if (hpModifier) {
      this.map.events.cardHp(this.serialize(), this.index);
    }
  };

  public capturePreviousHp(): void {
    this._previousHp = this._hp;
  };
  
  public voidPreviousHp(): void {
    this._previousHp = null;
  };
}