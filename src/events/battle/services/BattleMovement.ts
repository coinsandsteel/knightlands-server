import _ from "lodash";
import { BattleController } from "../BattleController";
import { PATH_SCHEME_QUEEN, PATH_SCHEME_ROOK, SETTINGS, TERRAIN_ICE, TERRAIN_SWAMP, TERRAIN_LAVA, TERRAIN_WOODS, TERRAIN_HILL } from "../meta";
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

  public getRangeCells(unitIndex: number, range: number, scheme: string): number[] {
    const result = [];
    for (let index = 0; index < 35; index++) {
      if (index === unitIndex) {
        continue;
      }
      let path = this.getPath(unitIndex, index, scheme);
      if (
        path 
        && 
        path.length <= range
      ) {
        result.push(index);
      }
    }
    return result;
  }

  public getPath(from: number, to: number, scheme: string): any {
    const unitNodes = this._ctrl.game.allUnits
      .filter(unit => ![from, to].includes(unit.index))
      .map(unit => `${unit.index}`);
    const thornsNodes = this._ctrl.game.terrain.getThornsIndexes();
    const path = this.routes[scheme].path(
      `${from}`, 
      `${to}`, 
      { trim: true, avoid: [...unitNodes, ...thornsNodes] }
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
    }
  }

  public moveFighter(fighter: Unit, index: number): void {
    const moveCells = this.getRangeCells(fighter.index, fighter.speed, SETTINGS.moveScheme);
    if (!moveCells.includes(index)) {
      return;
    }

    const source = "terrain";

    // Calc if there's any obstacles on the way
    // Interim cells only.
    let path = this.getPath(fighter.index, index, SETTINGS.moveScheme);
    for (let pathIndex in path) {
      const terrain = this._ctrl.game.terrain.getTerrainTypeByIndex(+pathIndex);
      if (!terrain) {
        continue;
      }

     // Ice - Stops a unit and increases the damage it takes by 25%.    
     // Swamp - Stops the unit and reduces the speed by 50% in the next turn
      if ([TERRAIN_ICE, TERRAIN_SWAMP].includes(terrain)) {
        // Found an obstacle, stop
        index = +pathIndex;

        // Remove existing TERRAIN_ICE and TERRAIN_SWAMP effects
        fighter.removeBuffs(source, SETTINGS.terrain[terrain].type);
        
        // Add new buff
        fighter.buff({ source, ...SETTINGS.terrain[terrain] });
        this._ctrl.events.buffs(fighter.fighterId, fighter.buffs);

        console.log(`Stepped into the ${terrain}`, { buffs: fighter.buffs });
        break;
      }

      // Lava - Deals damage equal to 5% of Max HP.
      if (terrain === TERRAIN_LAVA) {
        const damage = this._ctrl.game.terrain.getLavaDamage(fighter.maxHp);
        fighter.modifyHp(-damage);

        this._ctrl.events.effect({
          action: "effect",
          source: {
            terrain,
            index
          },
          target: {
            fighterId: fighter.fighterId,
            index,
            newHp: fighter.hp
          },
          effect: {
            effectClass: "heat",
            damage
          }
        });

        console.log(`Stepped into the ${terrain}`, { damage });
      }
    }
    
    // Change unit's index
    fighter.setIndex(index);
    
    // Check target cell
    const currentIndexTerrain = this._ctrl.game.terrain.getTerrainTypeByIndex(index);
    if ([TERRAIN_HILL, TERRAIN_WOODS].includes(currentIndexTerrain)) {
      // Remove existing TERRAIN_ICE and TERRAIN_SWAMP effects
      fighter.removeBuffs(source, SETTINGS.terrain[currentIndexTerrain].type);
      
      // Hills, highlands - Increase damage to enemies by 25%
      // Forest - Increases unit's defense by 25%
      fighter.buff({ source, ...SETTINGS.terrain[currentIndexTerrain] });
      this._ctrl.events.buffs(fighter.fighterId, fighter.buffs);
      
      console.log(`Stand on the ${currentIndexTerrain}`, { buffs: fighter.buffs });
      
    } else if (currentIndexTerrain === null) {
      // Remove all the terrrain effects, except swamp
      fighter.removeBuffs(source);
      this._ctrl.events.buffs(fighter.fighterId, fighter.buffs);

      console.log(`Stand on the empty cell`, { buffs: fighter.buffs });
    }

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