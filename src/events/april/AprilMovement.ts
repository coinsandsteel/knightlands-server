import _ from "lodash";
import random from "../../random";
import { AprilMap } from "./AprilMap";
import { Unit } from "./units/Unit";
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
  protected matrix = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10,11,12,13,14],
    [15,16,17,18,19],
    [20,21,22,23,24],
  ];

  constructor (map: AprilMap){
    this._map =map;
    this.route = new Graph(GRAPH);
  }

  public getFirstPathIndex(enemyIndex: number, heroIndex: number) {
    const path = this.route.path(`${enemyIndex}`, `${heroIndex}`);
    let index = enemyIndex;
    if (path) {
      index = path.length < 3 ? enemyIndex : +path[1];
    }
    return index;
  }

  public getRandomNeighborIndex(enemyIndex: number) {
    const index = _.sample(Object.keys(GRAPH[enemyIndex]));
    return +index;
  }

  public getRandomQueenishIndex(enemyIndex: number) {
    const indexes = this.getIndex(enemyIndex);
    const currentHorizontalIndex = indexes.horizontal;
    const nextHorizontalIndex = random.intRange(0,4);
    
    if (currentHorizontalIndex === nextHorizontalIndex) {
      const subMatrix = this.matrix[nextHorizontalIndex].filter(index => index !== enemyIndex)
      return _.sample(subMatrix);
    } else {
      const horizontalIndexDiff = Math.abs(currentHorizontalIndex - nextHorizontalIndex);
      const currentVerticalIndex = indexes.vertical;
      
      const options = [
        currentVerticalIndex + horizontalIndexDiff,
        currentVerticalIndex - horizontalIndexDiff,
        currentVerticalIndex
      ].filter(option => option >= 0 && option <= 4);
      const choosedOption = _.sample(options);

      return _.clone(this.matrix[nextHorizontalIndex][choosedOption]);
    }
  }

  public getIndex(index: number) {
    const horizontal = this.matrix.findIndex(arr => arr.includes(index));
    const vertical = this.matrix[horizontal].findIndex(i => i === index);
    return {
      vertical,
      horizontal
    };
  }

  public getVisibleIndexes(unit: Unit, relativeIndexes: number[][]): number[] {
    const indexes = this._map.movement.getIndex(unit.index);
    const absoluteIndexes = relativeIndexes.map(row => {
      return [
        indexes.horizontal + row[0],
        indexes.vertical + row[1],
        this.getOneDimensionIndex(unit.index, indexes.horizontal, indexes.vertical)
      ];
    })
    
    const visibleIndexes = absoluteIndexes
      .filter(entry => entry[0] >= 0 && entry[0] <= 4 && entry[1] >= 0 && entry[1] <= 4)
      .map(entry => entry[2]);
    
    return visibleIndexes;
  }

  public getOneDimensionIndex(index: number, hIndex: number, vIndex: number) {
    return index + (hIndex * 5) + vIndex;
  }
}