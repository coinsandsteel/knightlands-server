import _ from "lodash";
import { v4 as uuidv4 } from "uuid";

import { AprilMap } from "../AprilMap";
import { AprilUnitBlueprint } from "../types";
import { UNIT_CLASS_CLOWN, UNIT_CLASS_JACK, UNIT_CLASS_TEETH, UNIT_CLASS_HARLEQUIN, UNIT_CLASS_HERO } from "../../../knightlands-shared/april";

export const BOMB_TIMER = 10;

export class Unit {
  protected _id: string;
  protected _index: number;
  protected _unitClass: string;
  protected _map: AprilMap;
  protected _sequence: number;
  protected _isDead: boolean;

  get id(): string {
    return this._id;
  }

  get map(): AprilMap {
    return this._map;
  }

  get index(): number {
    return this._index;
  }

  get unitClass(): string {
    return this._unitClass;
  }

  get sequence(): number {
    return this._sequence;
  }

  get isDead(): boolean {
    return this._isDead;
  }

  constructor(unit: AprilUnitBlueprint, map: AprilMap) {
    this._id = unit.id || uuidv4().split('-').pop();
    this._index = unit.index;
    this._unitClass = unit.unitClass;
    this._isDead = unit.isDead;
    this._map = map;
    this._sequence = 0;
  }

  public move(index?: number): void {
    switch (this.unitClass) {
      case UNIT_CLASS_TEETH:
      case UNIT_CLASS_CLOWN:{
        // Move distance: 1 cell
        // Move direction: any, towards enemy
        const cellsAroundHero = this.map.movement.getCellsAroundHero();
        const targetIndex = _.sample(cellsAroundHero);
        this._index = this.map.movement.getFirstPathIndex(this.index, targetIndex);
        break;
      }
      case UNIT_CLASS_JACK: {
        // Move distance: 1 cell
        // Move direction: any
        this._index = this.map.movement.getRandomNeighborIndex(this.index);
        break;
      }
      case UNIT_CLASS_HARLEQUIN: {
        // Move distance: any
        // Move direction: any
        this._index = this.map.movement.getRandomQueenishIndex(this.index);
        break;
      }
      case UNIT_CLASS_HERO: {
        this._index = index;
        break;
      }
    }
  };

  public switchSequence(): void {
    this._sequence++;
    if (this._sequence > 3) {
      this._sequence = 0;
    }
  };

  public serialize(): AprilUnitBlueprint {
    const card = {
      id: this._id,
      unitClass: this.unitClass,
      index: this._index,
    } as AprilUnitBlueprint;
    
    return _.cloneDeep(card);
  };

  public kill(): void {
    this._isDead = true;
  }
}