import _ from "lodash";
import { ABILITY_MOVE, TERRAIN_ICE, TERRAIN_SWAMP, TERRAIN_LAVA, TERRAIN_WOODS, TERRAIN_HILL, TERRAIN_THORNS, ABILITY_SHIELD_WALL } from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import { PATH_SCHEME_QUEEN, PATH_SCHEME_ROOK, SETTINGS } from "../meta";
import { Unit } from "../units/Unit";
import { BattleService } from "./BattleService";
import { Fighter } from "../units/Fighter";
import game from "../../../game";
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

  public getMoveAttackCells(unitIndex: number, moveRange: number, attackRange: number, ignoreObstacles: boolean, ignoreTerrain: boolean): number[] {
    //this.log("Attack cells calculation", { unitIndex, moveRange, attackRange });
    let result = [];
    const moveCells = this.getMoveCellsByRange(unitIndex, moveRange, ignoreObstacles, ignoreTerrain);
    moveCells[unitIndex] = 0;
    for (let moveIndex in moveCells) {
      for (let attackIndex = 0; attackIndex < 35; attackIndex++) {
        // Calc attack path
        let path = this.getPath(parseInt(moveIndex), attackIndex, true);
        //this.log("Attack path", { from: moveCell, to: index, path });
        if (
          path
          &&
          (path.length + 1) <= attackRange
        ) {
          //this.log("Attack path accepted (path.length=${path.length} < attackRange=${path.length})", { pathLength: moveCell, to: index, path });
          result.push(attackIndex);
        }
      }
    }
    result = _.uniq(result);
    //this.log("Attack cells", { unitIndex, moveRange, attackRange, result });
    return result;
  };

  public getMoveCellsByAbility(fighter: Fighter, abilityClass: string, onlyIndexes?: boolean): { [index: number]: number; } | number[] {
    if (fighter.hasAgro && fighter.buffs.getBuffs({ source: ABILITY_SHIELD_WALL })) {
      return [];
    }

    let moveRange = 0;
    let ignoreObstacles = false;
    let ignoreTerrain = false;

    if (abilityClass === ABILITY_MOVE) {
      moveRange = fighter.speed;
    } else {
      const abilityData = fighter.abilities.getAbilityByClass(abilityClass);
      const abilityMeta = fighter.abilities.getMeta(abilityClass);
      moveRange = abilityData.range.move;
      ignoreObstacles = abilityMeta.ignoreObstacles;
      ignoreTerrain = abilityMeta.ignoreTerrain;
    }

    let result = this.getMoveCellsByRange(fighter.index, moveRange, ignoreObstacles, ignoreTerrain);
    if (onlyIndexes) {
      result = _.uniq(Object.keys(result).map(index => parseInt(index))) as number[];
    }

    return result;
  };

  // { index: path length }
  protected getMoveCellsByRange(unitIndex: number, range: number, ignoreObstacles: boolean, ignoreTerrain: boolean): { [index: number]: number; } {
    const result = {};
    const unitIndexes = this._core.game.allFighters.map(unit => unit.index);
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
      let stopperIsOnTheWay = path ? this.stopperIsOnTheWay(path) : false;

      //this.log("Move path", { from: unitIndex, to: index, path });
      if (
        path
        &&
        (path.length + 1) <= range
        &&
        !stopperIsOnTheWay
      ) {
        //this.log("Move path accepted (path.length=${path.length} < range=${range})", { pathLength: path.length, to: index, path });
        result[index] = path.length + 1;
      }
    }
    //this.log("Move cells", { unitIndex, range, result });
    return result;
  };

  protected stopperIsOnTheWay(path: number[]): boolean {
    const stopperIndex = path.findIndex(index => {
      const terrain = this._core.game.terrain.getTerrainTypeByIndex(index);
      return [TERRAIN_ICE, TERRAIN_SWAMP].includes(terrain);
    });
    return stopperIndex !== -1;
  }

  public getPath(from: number, to: number, ignoreObstacles: boolean): number[]|null {
    const avoidNodes  = [];

    if (!ignoreObstacles) {
      const unitNodes = this._core.game.allFighters
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
    return path ? path.map(index => parseInt(index)) : null;
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

  protected handleTerrain(fighter: Fighter, index: number, terrain: string|null, moving: boolean): { effects: any[], stop: boolean } {
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

  public moveFighter(fighter: Fighter, abilityClass: string, index: number): void {
    const moveCells = this.getMoveCellsByAbility(fighter, abilityClass, true) as number[];
    if (!moveCells.includes(index)) {
      return;
    }

    const effects = [];

    // Calc if there's any obstacles on the way
    // Interim cells only.
    const abilityMeta = fighter.abilities.getMeta(abilityClass);
    const ignoreTerrain = abilityMeta ? abilityMeta.ignoreTerrain : false;
    const ignoreObstacles = abilityMeta ? abilityMeta.ignoreObstacles : false;

    if (!ignoreTerrain) {
      let path = this.getPath(fighter.index, index, ignoreObstacles);
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