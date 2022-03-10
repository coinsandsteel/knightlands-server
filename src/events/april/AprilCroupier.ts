import Random from "../../random";
import { AprilMap } from "./AprilMap";
import { AprilCard } from "./types";


export class AprilCroupier {
  protected _map: AprilMap;

  constructor(map: AprilMap) {
    this._map = map;
  }
}