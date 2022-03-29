import _ from "lodash";
import { AprilMap } from "./AprilMap";
const Graph = require('node-dijkstra');

const GRAPH = {
  0: {1:1, 5:1, 6:1},
  1: {0:1, 2:1, 5:1, 6:1, 7:1},
  2: {1:1, 3:1, 6:1, 7:1, 8:1},
  3: {2:1, 4:1, 7:1, 8:1, 9:1},
  4: {3:1, 8:1, 9:1},
  
  5: {0:1, 1:1, 6:1, 10:1, 11:1},
  6: {0:1, 1:1, 2:1, 5:1, 7:1, 10:1, 11:1, 12:1},
  7: {1:1, 2:1, 3:1, 6:1, 8:1, 11:1, 12:1, 13:1},
  8: {2:1, 3:1, 4:1, 7:1, 9:1, 12:1, 13:1, 14:1},
  9: {3:1, 4:1, 8:1, 13:1, 14:1},

  10: {5:1, 6:1, 11:1, 15:1, 16:1},
  11: {5:1, 6:1, 7:1, 10:1, 12:1, 15:1, 16:1, 17:1},
  12: {6:1, 7:1, 8:1, 11:1, 13:1, 16:1, 17:1, 18:1},
  13: {7:1, 8:1, 9:1, 12:1, 14:1, 17:1, 18:1, 19:1},
  14: {8:1, 9:1, 13:1, 18:1, 19:1},

  15: {10:1, 11:1, 16:1, 20:1, 21:1},
  16: {10:1, 11:1, 12:1, 15:1, 17:1, 20:1, 21:1, 22:1},
  17: {11:1, 12:1, 13:1, 16:1, 18:1, 21:1, 22:1, 23:1},
  18: {12:1, 13:1, 14:1, 17:1, 19:1, 22:1, 23:1, 24:1},
  19: {13:1, 14:1, 18:1, 23:1, 24:1},

  20: {15:1, 16:1, 21:1},
  21: {15:1, 16:1, 17:1, 20:1, 22:1},
  22: {16:1, 17:1, 18:1, 21:1, 23:1},
  23: {17:1, 18:1, 19:1, 22:1, 24:1},
  24: {18:1, 19:1, 23:1}
};

export class AprilMovement {
  protected _map: AprilMap;
  protected route;

  constructor (map: AprilMap){
    this._map = map;
    this.route = new Graph(GRAPH);
  }

  public getFirstPathIndex(enemyIndex: number, heroIndex: number): number {
    const path = this.route.path(`${enemyIndex}`, `${heroIndex}`);
    let index = enemyIndex;
    if (path) {
      index = path.length <= 2 ? enemyIndex : +path[1];
    }
    if (this._map.playground.findUnitByIndex(index)) {
      index = enemyIndex;
    }
    return index;
  }

  public getRandomNeighborIndex(enemyIndex: number): number {
    let freeNeighbors = this.getFreeNeigbors(enemyIndex);
    let index = freeNeighbors.length ? _.sample(freeNeighbors) : enemyIndex;
    return +index;
  }

  public getCellsAroundHero(): number[] {
    const relativeMap = [
      [-1, -1],
      [-1,  0],
      [-1,  1],
      [ 0, -1],
      [ 0,  1],
      [ 1, -1],
      [ 1,  0],
      [ 1,  1],
    ];
    const heroIndex = this._map.playground.hero.index;
    const indexes = this.getVisibleIndexes(heroIndex, relativeMap);
    return indexes;
  }

  public getCornerPositions(enemyIndex: number): number[] {
    const relativeMap = [
      [-1, -1],
      [-1,  1],
      [ 1, -1],
      [ 1,  1],
    ];

    let busyCells = this._map.playground.getBusyIndexes();
    let freeNeighbors = this.getFreeNeigbors(enemyIndex);
    let nextEnemiesIndexes = this.getVisibleIndexes(enemyIndex, relativeMap);
    
    freeNeighbors = _.shuffle(
      freeNeighbors.filter(index => !nextEnemiesIndexes.includes(index))
    );
    nextEnemiesIndexes = nextEnemiesIndexes.map(
      index => busyCells.includes(index) ? freeNeighbors.pop() : index
    );

    return nextEnemiesIndexes;
  }

  protected getFreeNeigbors(index: number): number[] {
    let neighbors = Object.keys(GRAPH[index]);
    let busyCells = this._map.playground.getBusyIndexes();
    let freeNeighbors = neighbors
      .map(i => +i)
      .filter(x => !busyCells.includes(+x));
    return freeNeighbors;
  }

  public getRandomQueenishIndex(enemyIndex: number): number {
    const relativeMap = [
      // Up
      [-4, 0], [-3, 0], [-2, 0], [-1, 0],
      // Down
      [1, 0], [2, 0], [3, 0], [4, 0],
      // Left
      [0, -1], [0, -2], [0, -3], [0, -4],
      // Right
      [0, 1], [0, 2], [0, 3], [0, 4],
      // Top-left
      [-4, -4], [-3, -3], [-2, -2], [-1, -1],
      // Top-right
      [-4, 4], [-3, 3], [-2, 2], [-1, 1],
      // Bottom-left
      [4, -4], [3, -3], [2, -2], [1, -1],
      // Bottom-right
      [4, 4], [3, 3], [2, 2], [1, 1],
    ];

    let possibleIndexes = this.getVisibleIndexes(enemyIndex, relativeMap);
    let busyCells = this._map.playground.getBusyIndexes();
    let freeIndexes = possibleIndexes.filter(x => !busyCells.includes(x));
    let index = freeIndexes.length ? _.sample(freeIndexes) : enemyIndex;
    
    return index;
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

  public getAbsoluteIndex(hIndex: number, vIndex: number): number {
    return (hIndex * 5) + vIndex;
  }
}