import _ from "lodash";
import { BattleController } from "../BattleController";
import { TERRAIN } from "../meta";
import { BattleTerrainMap } from "../types";

export class BattleTerrain {
  protected _ctrl: BattleController;

  constructor (ctrl: BattleController){
    this._ctrl = ctrl;
  }

  public getRandomMap(): BattleTerrainMap {
    const map = _.cloneDeep(_.sample(TERRAIN));
    return map;
  }
}