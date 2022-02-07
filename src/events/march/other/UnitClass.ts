import { MarchMap } from "../MarchMap";
import { HpClass } from "./HpClass";
import { StepInterface } from "./StepInterface";
import { v4 as uuidv4 } from "uuid";

export class Unit extends HpClass implements StepInterface {
  protected _id: string;
  protected _map: MarchMap;
  protected class: string;
  protected level?: number;

  get map(): MarchMap {
    return this._map;
  }

  constructor(map: MarchMap) {
    super();
    this._map = map;
    this._id = uuidv4().split('-').slice(-1);
  }

  public activate(): void {};
  public touch(): void {};
  public destroy(): void {};
  public userStepCallback(): void {};
}