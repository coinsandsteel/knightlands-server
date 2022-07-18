import _ from "lodash";
import { BattleController } from "../BattleController";
import { SETTINGS, TERRAIN } from "../meta";
import { BattleTerrainMap } from "../types";

export class BattleTerrain {
  protected _ctrl: BattleController;
  protected _state: BattleTerrainMap;
  protected _coreMap: (string|null)[];

  constructor (state: BattleTerrainMap|null, ctrl: BattleController){
    this._ctrl = ctrl;

    if (state) {
      this._state = state;
      this.setCoreMap();
    }
  }

  public getState(): BattleTerrainMap {
    return this._state;
  }
  
  public setMap(map: BattleTerrainMap): void {
    this._state = map;
    this._ctrl.events.terrain(this._state);
    this.setCoreMap();
  }

  public setRandomMap(): void {
    this.setMap(_.cloneDeep(_.sample(TERRAIN)));
  }

  public setCoreMap(): void {
    if (!this._state || !this._state.tiles.length) {
      throw Error("Map wasn't set");
    }

    const coreMap = [];
    const slots = [null, null, null, null, null];
    const tileTypes = [
      "woods",
      "hill",
      "swamp",
      "thorns",
      "lava"
    ];

    const terrain = this._state.tiles.map(asset => {
      return tileTypes.find(tile => { 
        return asset ? asset.indexOf(tile) !== -1 : false; 
      }) || null;
    });

    coreMap.push(...slots, ...terrain, ...slots);
    this._coreMap = coreMap;
  }

  public getTerrainTypeByIndex(index: number): string|null {
    return this._coreMap[index];
  }

  public getLavaDamage(maxHp: number): number {
    return Math.round(maxHp * SETTINGS.lavaDamage);
  }

  public getThornsIndexes(): number[] {
    const indexes = [];
    this._coreMap.forEach((asset, index) => {
      if (asset === "thorns") {
        indexes.push(index);
      }
    });
    return indexes;
  }
}
