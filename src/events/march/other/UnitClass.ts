import { MarchMap } from "../MarchMap";
import { HpClass } from "./HpClass";
import { StepInterface } from "./StepInterface";
import { v4 as uuidv4 } from "uuid";
import { MarchCard } from "../types";
import * as march from "../../../knightlands-shared/march";
import { Loot } from "../units/Loot";

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
  
  constructor(unitClass: string, initialHp: number, map: MarchMap, id?: string) {
    super();
    
    this._unitClass = unitClass;
    this._map = map;
    this._hp = initialHp;

    if (!id) {
      this._id = uuidv4().split('-').pop();
    }
  }

  public setOpened(opened: boolean): void {
    this._opened = opened;
  };

  public replaceWithGold(): void {
    const newUnit = new Loot(march.UNIT_CLASS_GOLD, this.hp, this.map);
    this.map.replaceCellWith(this, newUnit);
  }
  
  public activate(): void {};
  public touch(): void {};
  public destroy(): void {};
  public userStepCallback(): void {};

  public serialize(): MarchCard {
    const card = {
      _id: this._id,
      hp: this._hp,
      unitClass: this.unitClass
    } as MarchCard;

    if (this.opened !== null) {
      card.opened = this.opened;
    }
    
    return card;
  };

  public modifyHp(value: number, modifier?: Unit): void {
    this._hp += value;
    if (this.isDead()) {
      if ([
        march.UNIT_CLASS_DRAGON_BREATH,
        march.UNIT_CLASS_BOMB,
        march.UNIT_CLASS_BALL_LIGHTNING,
        march.UNIT_CLASS_BOW,
      ].includes(modifier.unitClass)) {
        this.replaceWithGold();
        return;
      }
      this.destroy();
    }
  };
}