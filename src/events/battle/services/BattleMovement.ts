import _ from "lodash";
import { BattleController } from "../BattleController";
const Graph = require('node-dijkstra');

export class BattleMovement {
  protected _ctrl: BattleController;
  protected route;
  protected graph;

  constructor (ctrl: BattleController){
    this._ctrl = ctrl;

    this.setGraph();
    this.route = new Graph(this.graph);
  }

  protected setGraph(): void{
    let graph = {};
    for (let index = 0; index < 35; index++) {
      graph[index] = {};
      let indexCoords = this.getIndex(index);
      for (let neighbor = 0; neighbor < 35; neighbor++) {
        if (index === neighbor) continue;
        let neighborCoords = this.getIndex(neighbor);
        if (
          // Queen mode
          /*[-1, 0, 1].includes(indexCoords.horizontal - neighborCoords.horizontal)
          &&
          [-1, 0, 1].includes(indexCoords.vertical - neighborCoords.vertical)*/
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
        ) {
          graph[index][neighbor] = 1;
        }
      }
    }
    this.graph = graph;
    //console.log("setGraph", { graph });
  }

  public getRangeCells(unitIndex: number, range: number): number[] {
    const result = [];
    for (let index = 0; index < 35; index++) {
      if (index === unitIndex) {
        continue;
      }
      let path = this.getPath(unitIndex, index);
      console.log("getRangeCells", { unitIndex, range, path });
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

  public getPath(from: number, to: number): any {
    const avoidNodes = this._ctrl.game.allUnits
      .filter(unit => ![from, to].includes(unit.index))
      .map(unit => `${unit.index}`);

    const path = this.route.path(`${from}`, `${to}`, { trim: true, avoid: avoidNodes });
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
}