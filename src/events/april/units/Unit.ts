import _ from "lodash";
import { AprilMap } from "../AprilMap";
import { AprilUnitBlueprint } from "../types";
import { v4 as uuidv4 } from "uuid";

export const BOMB_TIMER = 10;

export class Unit {
  protected _id: string;
  protected _index: number;
  protected _unitClass: string;
  protected _map: AprilMap;

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

  constructor(unit: AprilUnitBlueprint, map: AprilMap) {
    this._id = unit.id || uuidv4().split('-').pop();
    this._index = unit.index;
    this._unitClass = unit.unitClass;
    this._map = map;
  }

  public move(): void {};
  public userStepCallback(): void {};

  public serialize(): AprilUnitBlueprint {
    const card = {
      id: this._id,
      unitClass: this.unitClass,
      index: this._index,
    } as AprilUnitBlueprint;
    
    return _.cloneDeep(card);
  };
}