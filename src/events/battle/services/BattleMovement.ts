import _ from "lodash";
import { BattleController } from "../BattleController";
import { PATH_SCHEME_QUEEN, PATH_SCHEME_ROOK, SETTINGS, TERRAIN_ICE, TERRAIN_SWAMP, TERRAIN_LAVA, TERRAIN_WOODS, TERRAIN_HILL, TERRAIN_THORNS } from "../meta";
import { Unit } from "../units/Unit";
const Graph = require('node-dijkstra');

export class BattleMovement {
  protected _ctrl: BattleController;
  protected routes;
  protected graphs;

  constructor (ctrl: BattleController){
    this._ctrl = ctrl;

    this.setGraphs();

    this.routes = {
      rook: new Graph(this.graphs.rook),
      queen: new Graph(this.graphs.queen)
    };
  }

  protected setGraphs(): void{
    let graphs = {};

    [PATH_SCHEME_QUEEN, PATH_SCHEME_ROOK].forEach(scheme => {
      graphs[scheme] = {};

      for (let index = 0; index < 35; index++) {
        graphs[scheme][index] = {};
        let indexCoords = this.getIndex(index);

        for (let neighbor = 0; neighbor < 35; neighbor++) {
          if (index === neighbor) continue;
          let neighborCoords = this.getIndex(neighbor);
          
          // Queen scheme
          if (
            scheme === PATH_SCHEME_QUEEN
            &&
            [-1, 0, 1].includes(indexCoords.horizontal - neighborCoords.horizontal)
            &&
            [-1, 0, 1].includes(indexCoords.vertical - neighborCoords.vertical)
            ) {
              graphs[scheme][index][neighbor] = 1;
            }
            
          // Rook scheme
          if (
            scheme === PATH_SCHEME_ROOK
            &&
            (
              (
                Math.abs(indexCoords.horizontal - neighborCoords.horizontal) === 1
                &&
                indexCoords.vertical === neighborCoords.vertical
              )
              ||
              (
                Math.abs(indexCoords.vertical - neighborCoords.vertical) === 1
                &&
                indexCoords.horizontal === neighborCoords.horizontal
              )
            )
          ) {
            graphs[scheme][index][neighbor] = 1;
          }
        }
      }
    });
    this.graphs = graphs;
  }

  public getRangeCells(mode: "move"|"attack"|"jump", unitIndex: number, range: number, scheme: string): number[] {
    const result = [];
    const unitIndexes = this._ctrl.game.allUnits.map(unit => unit.index);
    for (let index = 0; index < 35; index++) {
      const terrain = this._ctrl.game.terrain.getTerrainTypeByIndex(index);
      // Cannot move or jump to units and thorns
      if (
        ["move", "jump"].includes(mode)
        && 
        (
          terrain === TERRAIN_THORNS
          ||
          unitIndexes.includes(index)
        )
      ) {
        continue;
      }

      let path = this.getPath(mode, unitIndex, index, scheme);
      if (
        path
        && 
        path.length < range
      ) {
        result.push(index);
      }
    }
    return result;
  }

  public getPath(mode: "move"|"attack"|"jump", from: number, to: number, scheme: string): any {
    const avoidNodes  = [];

    if (mode === "move") {
      const unitNodes = this._ctrl.game.allUnits
        .filter(unit => ![from, to].includes(unit.index))
        .map(unit => `${unit.index}`);

      const thornsNodes = this._ctrl.game.terrain
          .getThornsIndexes()
          .map(index => `${index}`);

      avoidNodes.push(...unitNodes, ...thornsNodes);
    }

    const path = this.routes[scheme].path(
      `${from}`,
      `${to}`,
      { trim: true, avoid: avoidNodes }
    );
    return path;
  }

  public getIndex(index: number): { vertical: number, horizontal: number } {
    const horizontal = (index / 5) << 0;
    const vertical = (index + 5) % 5;
    return {
      vertical,
      horizontal
    };
  }

  public getVisibleIndexes(unitIndex: number, relativeIndexes: number[][]): number[] {
    const indexes = this.getIndex(unitIndex);
    const absoluteIndexes = relativeIndexes.map(row => {
      const relativeIndexH = indexes.horizontal + row[0];
      const relativeIndexV = indexes.vertical + row[1];
      const absoluteIndex = this.getAbsoluteIndex(relativeIndexH, relativeIndexV);
      return {
        h: relativeIndexH, 
        v: relativeIndexV, 
        a: absoluteIndex
      };
    })
    
    const visibleIndexes = absoluteIndexes
      .filter(entry => entry.h >= 0 && entry.h <= 4 && entry.v >= 0 && entry.v <= 4)
      .map(entry => entry.a);

    return visibleIndexes;
  }

  public getAbsoluteIndex(vIndex: number, hIndex: number): number {
    return (vIndex * 5) + hIndex;
  }

  public tryLavaDamage(fighter: Unit): void {
    const terrain = this._ctrl.game.terrain.getTerrainTypeByIndex(fighter.index);
    if (terrain === TERRAIN_LAVA) {
      fighter.modifyHp(
        -this._ctrl.game.terrain.getLavaDamage(fighter.maxHp)
      );
      this._ctrl.game.chekIfFighterIsDead(fighter);
    }
  }

  protected handleTerrain(fighter: Unit, terrain: string, moving: boolean): { stop: boolean } {
    let stop = false;
    const source = "terrain";
    switch (terrain) {
      case TERRAIN_LAVA: {
        const damage = this._ctrl.game.terrain.getLavaDamage(fighter.maxHp);
        fighter.modifyHp(-damage);
        this._ctrl.game.chekIfFighterIsDead(fighter);
        console.log(`Passing through the ${terrain}`, { damage });
        break;
      }
      case TERRAIN_ICE:
      case TERRAIN_SWAMP: {
        // Found an obstacle, stop
        stop = true;
        // Remove existing TERRAIN_ICE and TERRAIN_SWAMP effects
        fighter.removeBuffs(source, SETTINGS.terrain[terrain].type);
        // Add new buff
        fighter.buff({ source, ...SETTINGS.terrain[terrain] });
        this._ctrl.events.buffs(fighter.fighterId, fighter.buffs);
        console.log((moving ? "Stand on" : "Passing through") + ` the ${terrain}`, { buffs: fighter.buffs });
        break;
      }
      case TERRAIN_HILL:
      case TERRAIN_WOODS: {
        if (moving) {
          break;
        }
        // Remove existing TERRAIN_ICE and TERRAIN_SWAMP effects
        fighter.removeBuffs(source, SETTINGS.terrain[terrain].type);
        // Hills, highlands - Increase damage to enemies by 25%
        // Forest - Increases unit's defense by 25%
        fighter.buff({ source, ...SETTINGS.terrain[terrain] });
        this._ctrl.events.buffs(fighter.fighterId, fighter.buffs);
        console.log(`Stand on the ${terrain}`, { buffs: fighter.buffs });
        break;
      }
      default: {
        fighter.removeBuffs(source);
        break;
      }
    }

    return { stop };
  }

  public moveFighter(fighter: Unit, index: number): void {
    const moveCells = this.getRangeCells("move", fighter.index, fighter.speed, SETTINGS.moveScheme);
    if (!moveCells.includes(index)) {
      return;
    }

    // Calc if there's any obstacles on the way
    // Interim cells only.
    let path = this.getPath("move", fighter.index, index, SETTINGS.moveScheme);
    for (let pathIndex of path) {
      const terrain = this._ctrl.game.terrain.getTerrainTypeByIndex(+pathIndex);
      console.log(`[Tile]`, { index: +pathIndex, terrain });
      if (!terrain) {
        continue;
      }

      let result = this.handleTerrain(fighter, terrain, true);
      if (result.stop) {
        console.log(`[Tile stopped the fighter]`, { index: +pathIndex});
        // Found an obstacle, stop
        index = +pathIndex;
        break;
      }
    }
    
    // Change unit's index
    fighter.setIndex(index);
    
    // Handle target terrain
    const currentIndexTerrain = this._ctrl.game.terrain.getTerrainTypeByIndex(index);
    this.handleTerrain(fighter, currentIndexTerrain, false);

    // Send effects
    this._ctrl.events.effect({
      action: "move",
      fighterId: fighter.fighterId,
      newIndex: index
    });

    // Void move cells
    this._ctrl.events.combatMoveCells([]);
  }
}