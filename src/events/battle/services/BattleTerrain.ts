import _ from "lodash";
import game from "../../../game";
import { BattleController } from "../BattleController";
import { SETTINGS, TERRAIN, TERRAIN_HILL, TERRAIN_ICE, TERRAIN_LAVA, TERRAIN_SWAMP, TERRAIN_THORNS, TERRAIN_WOODS } from "../meta";
import { BattleTerrainMap } from "../types";

export class BattleTerrain {
  protected _ctrl: BattleController;
  protected _state: BattleTerrainMap|null;
  protected _coreMap: (string|null)[];

  constructor (state: BattleTerrainMap|null, ctrl: BattleController){
    this._ctrl = ctrl;

    if (state) {
      this._state = state;
      this.setCoreMap();
      console.log("[Terrain] Old map was set", this._coreMap);
    } else {
      this._state = null;
    }
  }

  public getState(): BattleTerrainMap|null {
    return this._state;
  }
  
  public setMap(map: BattleTerrainMap): void {
    this._state = map;
    this._ctrl.events.terrain(this._state);
    this.setCoreMap();
  }

  public setRandomMap(): void {
    if (game.battleManager.autoCombat) {
      this.setMap({ base: "grass", tiles: new Array(25).fill(null) });
      console.log("[Terrain] Empty map was set");
    } else {
      this.setMap(_.cloneDeep(_.sample(TERRAIN)));
      console.log("[Terrain] Random map was set", this._coreMap);
    }
  }

  public setCoreMap(): void {
    if (!this._state || !this._state.tiles.length) {
      throw Error("Map wasn't set");
    }

    const coreMap = [];
    const slots = [null, null, null, null, null];
    const tileTypes = [
      TERRAIN_ICE,
      TERRAIN_WOODS,
      TERRAIN_HILL,
      TERRAIN_SWAMP,
      TERRAIN_THORNS,
      TERRAIN_LAVA
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
    // TODO add bonus
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
