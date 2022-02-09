import { MarchMap } from "../MarchMap";
import { HpClass } from "./HpClass";
import { StepInterface } from "./StepInterface";
import { v4 as uuidv4 } from "uuid";
import { MarchCard } from "../types";
import * as march from "../../../knightlands-shared/march";

export class Unit extends HpClass implements StepInterface {
  protected _id: string;
  protected _map: MarchMap;
  protected unitClass: string;
  protected opened: boolean|null = null;

  get map(): MarchMap {
    return this._map;
  }

  get id(): string {
    return this._id;
  }

  get isEnemy(): boolean {
    return this.unitClass === march.UNIT_CLASS_ENEMY || this.unitClass === march.UNIT_CLASS_ENEMY_BOSS || this.unitClass === march.UNIT_CLASS_TRAP;
  }

  get isPet(): boolean {
    return this.unitClass === march.UNIT_CLASS_PET;
  }

  get getUnitClass(): string {
    return this.unitClass;
  }

  constructor(map: MarchMap, id?: string) {
    super();
    this._map = map;

    if (!id) {
      this._id = uuidv4().split('-').pop();
    }
  }

  public setUnitClass(unitClass: string): void {
    this.unitClass = unitClass;
  };

  public setOpened(opened: boolean): void {
    this.opened = opened;
  };

  public activate(): void {};
  public touch(): void {};
  public destroy(): void {};
  public userStepCallback(): void {};
  public replaceWithGold(): void {}

  public serialize(): MarchCard {
    const card = {
      _id: this._id,
      hp: this.hp,
      unitClass: this.unitClass
    } as MarchCard;

    if (this.opened !== null) {
      card.opened = this.opened;
    }
    
    return card;
  };

  public modifyHp(value: number, modifier: Unit = null): void {
    this.hp += value;
    if (this.isDead()) {
      if (modifier && 
        (modifier.getUnitClass === march.UNIT_CLASS_DRAGON_BREATH || 
        modifier.getUnitClass === march.UNIT_CLASS_BOMB || 
        modifier.getUnitClass === march.UNIT_CLASS_BALL_LIGHTNING || 
        modifier.getUnitClass === march.UNIT_CLASS_BOW)) {
        this.replaceWithGold();
        return;
      }
      this.destroy();
    }
  };
}