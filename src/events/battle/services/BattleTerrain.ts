import _ from "lodash";
import game from "../../../game";
import { TERRAIN_ICE, TERRAIN_SWAMP, TERRAIN_LAVA, TERRAIN_WOODS, TERRAIN_HILL, TERRAIN_THORNS } from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import { TERRAIN } from "../meta";
import { BattleTerrainMap } from "../types";
import { BattleService } from "./BattleService";

export class BattleTerrain extends BattleService {
  protected _core: BattleCore;
  protected _state: BattleTerrainMap|null;
  protected _coreMap: (string|null)[];

  constructor (state: BattleTerrainMap|null, core: BattleCore){
    super();

    this._core = core;

    if (state) {
      this._state = state;
      this.setCoreMap();
      this.log("Old map was set", this._coreMap);
    } else {
      this._state = null;
    }
  }

  public getState(): BattleTerrainMap|null {
    return this._state;
  }
  
  public setMap(map: BattleTerrainMap): void {
    this._state = map;
    this._core.events.terrain(this._state);
    this.setCoreMap();
  }

  public setRandomMap(): void {
    this.setMap(_.cloneDeep(_.sample(TERRAIN)));
    this.log("Random map was set", this._coreMap);
  }

  public setEmptyMap(): void {
    this.setMap({ base: "grass", tiles: new Array(25).fill(null) });
    this.log("Empty map was set");
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
