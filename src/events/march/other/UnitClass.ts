import { MarchMap } from "../MarchMap";
import { HpClass } from "./HpClass";
import { StepInterface } from "./StepInterface";

export class Unit extends HpClass implements StepInterface {
  protected index: number;
  protected _map: MarchMap;
  get map(): MarchMap {
    return this._map;
  }
  constructor(map: MarchMap) {
    super();
    this._map = map;
  }
  protected type: string;
  protected tier?: number;
  public activate(): void {};
  public touch(): void {};
  public destroy(): void {};
  public userStepCallback(): void {};
  public replaceWith(unit: Unit): void {};
}