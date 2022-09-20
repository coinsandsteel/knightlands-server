import _ from "lodash";
import { ABILITY_MOVE, TERRAIN_ICE, TERRAIN_SWAMP, TERRAIN_LAVA, TERRAIN_WOODS, TERRAIN_HILL, TERRAIN_THORNS } from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import { PATH_SCHEME_QUEEN, PATH_SCHEME_ROOK, SETTINGS } from "../meta";
import { Unit } from "../units/Unit";
import { BattleService } from "./BattleService";
const Graph = require('node-dijkstra');

export class BattleMovement extends BattleService {
  protected _core: BattleCore;
  protected routes;
  protected graphs;

  constructor (core: BattleCore){
    super();
    this._core = core;

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

  public getMoveAttackCells(unitIndex: number, moveRange: number, attackRange: number, ignoreObstacles: boolean): number[] {
    //this.log("Attack cells calculation", { unitIndex, moveRange, attackRange });
    let result = [];
    const moveCells = this.getMoveCellsByRange(unitIndex, moveRange, ignoreObstacles);
    moveCells.push(unitIndex);
    moveCells.forEach(moveCell => {
      for (let index = 0; index < 35; index++) {
        let path = this.getPath(moveCell, index, true);
        //this.log("Attack path", { from: moveCell, to: index, path });
        if (
          path
          &&
          path.length < attackRange
        ) {
          //this.log("Attack path accepted (path.length=${path.length} < attackRange=${path.length})", { pathLength: moveCell, to: index, path });
          result.push(index);
        }
      }
    });
    result = _.uniq(result);
    //this.log("Attack cells", { unitIndex, moveRange, attackRange, result });
    return result;
  };

  public getMoveCellsByAbility(fighter: Unit, abilityClass: string): number[] {
    let range = 0;
    let ignoreObstacles = false;
    if (abilityClass === ABILITY_MOVE) {
      range = fighter.speed;
    } else {
      const abilityStat = fighter.abilities.getAbilityStat(abilityClass);
      range = abilityStat.moveRange;
      ignoreObstacles = abilityStat.ignoreObstacles;
    }

    return this.getMoveCellsByRange(fighter.index, range, ignoreObstacles);
  };

  public getMoveCellsByRange(unitIndex: number, range: number, ignoreObstacles: boolean): number[] {
    const result = [];
    const unitIndexes = this._core.game.allUnits.map(unit => unit.index);
    for (let index = 0; index < 35; index++) {
      const terrain = this._core.game.terrain.getTerrainTypeByIndex(index);
      // Cannot get onto units and thorns
      if (
        terrain === TERRAIN_THORNS
        ||
        unitIndexes.includes(index)
      ) {
        continue;
      }

      let path = this.getPath(unitIndex, index, ignoreObstacles);
      //this.log("Move path", { from: unitIndex, to: index, path });
      if (
        path
        && 
        path.length < range
      ) {
        //this.log("Move path accepted (path.length=${path.length} < range=${range})", { pathLength: path.length, to: index, path });
        result.push(index);
      }
    }
    //this.log("Move cells", { unitIndex, range, result });
    return result;
  };

  public getPath(from: number, to: number, ignoreObstacles: boolean): any {
    const avoidNodes  = [];

    if (!ignoreObstacles) {
      const unitNodes = this._core.game.allUnits
        .filter(unit => ![from, to].includes(unit.index))
        .map(unit => `${unit.index}`);
  
      const thornsNodes = this._core.game.terrain
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

  protected handleTerrain(fighter: Unit, index: number, terrain: string|null, moving: boolean): { effects: any[], stop: boolean } {
    const result = {
      effects: [],
      stop: false
    };
    switch (terrain) {
      case TERRAIN_LAVA: {
        this.log(`Passing through the ${terrain}`);

        const oldHp = _.clone(fighter.hp);
        fighter.buffs.launchTerrainEffect(terrain);

        result.effects.push({
          action: "terrain",
          type: TERRAIN_LAVA,
          target: {
            fighterId: fighter.fighterId,
            index,
            oldHp,
            newHp: fighter.hp
          }
        });
        break;
      }
      case TERRAIN_ICE:
      case TERRAIN_SWAMP: {
        // Found an obstacle, stop
        result.stop = true;
        fighter.buffs.launchTerrainEffect(terrain);
        this.log((moving ? "Stand on" : "Passing through") + ` the ${terrain}`, { buffs: fighter.buffs });
        break;
      }
      case TERRAIN_HILL:
      case TERRAIN_WOODS: {
        if (moving) {
          break;
        }
        fighter.buffs.launchTerrainEffect(terrain);
        this.log(`Stand on the ${terrain}`, { buffs: fighter.buffs });
        break;
      }
      default: {
        fighter.buffs.launchTerrainEffect(terrain);
        break;
      }
    }

    return result;
  }

  public moveFighter(fighter: Unit, abilityClass: string, index: number): void {
    const moveCells = this.getMoveCellsByAbility(fighter, abilityClass);
    if (!moveCells.includes(index)) {
      return;
    }

    const effects = [];

    // Calc if there's any obstacles on the way
    // Interim cells only.
    let path = this.getPath(fighter.index, index, false);
    for (let pathIndex of path) {
      const terrain = this._core.game.terrain.getTerrainTypeByIndex(+pathIndex);
      //this.log(`[Tile]`, { index: +pathIndex, terrain });
      if (!terrain) {
        continue;
      }

      let result = this.handleTerrain(fighter, pathIndex, terrain, true);
      if (result.stop) {
        this.log(`Tile stopped the fighter`, { index: +pathIndex});
        // Found an obstacle, stop
        index = +pathIndex;
        break;
      }
      if (result.effects.length) {
        effects.push(...result.effects);
      }
    }
    
    // Change unit's index
    fighter.setIndex(index);
    
    // Handle destination terrain
    const currentIndexTerrain = this._core.game.terrain.getTerrainTypeByIndex(index);
    let result = this.handleTerrain(fighter, fighter.index, currentIndexTerrain, false);
    if (result.effects.length) {
      effects.push(...result.effects);
    }

    // Send effects
    this._core.events.effect({
      action: "move",
      fighterId: fighter.fighterId,
      newIndex: index
    });
    effects.forEach(effect => this._core.events.effect(effect));

    // Void move cells
    this._core.events.combatMoveCells([]);
  }
}