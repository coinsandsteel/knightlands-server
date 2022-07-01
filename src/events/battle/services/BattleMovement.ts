import _ from "lodash";
import { BattleController } from "../BattleController";
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

    ["queen", "rook"].forEach(scheme => {
      graphs[scheme] = {};

      for (let index = 0; index < 35; index++) {
        graphs[scheme][index] = {};
        let indexCoords = this.getIndex(index);

        for (let neighbor = 0; neighbor < 35; neighbor++) {
          if (index === neighbor) continue;
          let neighborCoords = this.getIndex(neighbor);
          
          // Queen scheme
          if (
            scheme === "queen"
            &&
            [-1, 0, 1].includes(indexCoords.horizontal - neighborCoords.horizontal)
            &&
            [-1, 0, 1].includes(indexCoords.vertical - neighborCoords.vertical)
            ) {
              graphs[scheme][index][neighbor] = 1;
            }
            
          // Rook scheme
          if (
            scheme === "rook"
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
    const avoidNodes = this._ctrl.game.allUnits
      .filter(unit => ![from, to].includes(unit.index))
      .map(unit => `${unit.index}`);

    const path = this.routes[scheme].path(`${from}`, `${to}`, { trim: true, avoid: avoidNodes });
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

  public moveFighter(fighter: Unit, index: number): void {
    const moveCells = this.getRangeCells(fighter.index, fighter.speed, "rook");
    if (!moveCells.includes(index)) {
      return;
    }

    // Launch move, calc if there's any obstacles

    // Add obstacles effects

    // Change unit's index
    fighter.setIndex(index);

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