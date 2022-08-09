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

  public getMoveAttackCells(unitIndex: number, moveRange: number, attackRange: number): number[] {
    console.log("[Movement] Attack cells calculation", { unitIndex, moveRange, attackRange });
    let result = [];
    const moveCells = this.getMoveCells(unitIndex, moveRange);
    moveCells.push(unitIndex);
    moveCells.forEach(moveCell => {
      for (let index = 0; index < 35; index++) {
        let path = this.getPath(moveCell, index, false);
        //console.log("[Movement] Attack path", { from: moveCell, to: index, path });
        if (
          path
          &&
          path.length < attackRange
        ) {
          //console.log(`[Movement] Attack path accepted (path.length=${path.length} < attackRange=${path.length})`, { pathLength: moveCell, to: index, path });
          result.push(index);
        }
      }
    });
    result = _.uniq(result);
    //console.log("[Movement] Attack cells", { unitIndex, moveRange, attackRange, result });
    return result;
  };

  public getMoveCells(unitIndex: number, range: number): number[] {
    const result = [];
    const unitIndexes = this._ctrl.game.allUnits.map(unit => unit.index);
    for (let index = 0; index < 35; index++) {
      const terrain = this._ctrl.game.terrain.getTerrainTypeByIndex(index);
      // Cannot get onto units and thorns
      if (
        terrain === TERRAIN_THORNS
        ||
        unitIndexes.includes(index)
      ) {
        continue;
      }

      let path = this.getPath(unitIndex, index, true);
      //console.log("[Movement] Move path", { from: unitIndex, to: index, path });
      if (
        path
        && 
        path.length < range
      ) {
        //console.log(`[Movement] Move path accepted (path.length=${path.length} < range=${range})`, { pathLength: path.length, to: index, path });
        result.push(index);
      }
    }
    //console.log("[Movement] Move cells", { unitIndex, range, result });
    return result;
  };

  public getPath(from: number, to: number, avoidObstacles: boolean): any {
    const avoidNodes  = [];

    if (avoidObstacles) {
      const unitNodes = this._ctrl.game.allUnits
        .filter(unit => ![from, to].includes(unit.index))
        .map(unit => `${unit.index}`);
  
      const thornsNodes = this._ctrl.game.terrain
          .getThornsIndexes()
          .map(index => `${index}`);
  
      avoidNodes.push(...unitNodes, ...thornsNodes);
    }

    const path = this.routes[SETTINGS.moveScheme].path(
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

  protected handleTerrain(fighter: Unit, terrain: string|null, moving: boolean): { stop: boolean } {
    let stop = false;
    switch (terrain) {
      case TERRAIN_LAVA: {
        console.log(`[Movement] Passing through the ${terrain}`);
        const oldHp = fighter.hp;
        fighter.launchTerrainEffect(terrain);

        this._ctrl.events.effect({
          action: "terrain",
          type: TERRAIN_LAVA,
          target: {
            fighterId: fighter.fighterId,
            index: fighter.index,
            oldHp,
            newHp: fighter.hp
          }
        });
        break;
      }
      case TERRAIN_ICE:
      case TERRAIN_SWAMP: {
        console.log("[Movement] " +(moving ? "Stand on" : "Passing through") + ` the ${terrain}`, { buffs: fighter.buffs });
        // Found an obstacle, stop
        stop = true;
        fighter.launchTerrainEffect(terrain);
        break;
      }
      case TERRAIN_HILL:
      case TERRAIN_WOODS: {
        if (moving) {
          break;
        }
        console.log(`[Movement] Stand on the ${terrain}`, { buffs: fighter.buffs });
        fighter.launchTerrainEffect(terrain);
        break;
      }
      default: {
        fighter.launchTerrainEffect(terrain);
        break;
      }
    }

    return { stop };
  }

  public moveFighter(fighter: Unit, index: number): void {
    const moveCells = this.getMoveCells(fighter.index, fighter.speed);
    if (!moveCells.includes(index)) {
      return;
    }

    // Calc if there's any obstacles on the way
    // Interim cells only.
    let path = this.getPath(fighter.index, index, true);
    for (let pathIndex of path) {
      const terrain = this._ctrl.game.terrain.getTerrainTypeByIndex(+pathIndex);
      //console.log(`[Tile]`, { index: +pathIndex, terrain });
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
    
    // Handle destination terrain
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