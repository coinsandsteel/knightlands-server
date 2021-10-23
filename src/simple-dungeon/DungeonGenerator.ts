import _ from "lodash";
import random from "../random";
import Game from "../game";
import { Cell, DungeonEnemiesCompact, DungeonFloorData, DungeonFloorSettings } from "./types";

export function cellToIndex(cell: Cell, width: number) {
    return cell.y * width + cell.x;
}

export class DungeonGenerator {
    private _config: DungeonFloorSettings;

    constructor(config: DungeonFloorSettings) {
        this._config = config;
    }

    range(min: number, max: number) {
        return random.intRange(min, max);
    }

    cellToIndex(cell: Cell) {
        return cellToIndex(cell, this._config.width);
    }

    shuffle(cells: any[]) {
        return random.shuffle(cells);
    }

    randomNeighbours(cell: Cell, filter: (cell: Cell) => boolean) {
        const cells: Cell[] = [];
        // left
        if (cell.x > 0) {
            const nc = { x: cell.x - 1, y: cell.y, c: [] };
            if (filter(nc)) {
                cells.push(nc);
            }
        }

        // top
        if (cell.y > 0) {
            const nc = { x: cell.x, y: cell.y - 1, c: [] };
            if (filter(nc)) {
                cells.push(nc);
            }
        }

        // right
        if (cell.x < this._config.width - 1) {
            const nc = { x: cell.x + 1, y: cell.y, c: [] };
            if (filter(nc)) {
                cells.push(nc);
            }
        }

        // bottom
        if (cell.y < this._config.height - 1) {
            const nc = { x: cell.x, y: cell.y + 1, c: [] };
            if (filter(nc)) {
                cells.push(nc);
            }
        }

        return this.shuffle(cells);
    }

    randomNotConnected(cell: Cell) {
        const cells = {};
        for (const cellIdx of cell.c) {
            cells[cellIdx] = true;
        }

        return this.randomNeighbours(cell, c => !cells[this.cellToIndex(c)]);
    }

    expandEnemyConfig(enemiesConfig: DungeonEnemiesCompact[]) {
        const enemyList = [];
        const enemiesMeta = Game.dungeonManager.getMeta().enemies;
        for (let k = enemiesConfig.length - 1; k >= 0; --k) {
            const config = enemiesConfig[k];
            for (let i = 0; i < config.count; ++i) {
                enemyList.push(
                  _.sample(enemiesMeta.enemiesByDifficulty[config.difficulty])
                );
            }
        }

        return enemyList;
    }

    async placeEnemies(start: Cell, cells: Cell[]) {
        // first, place main enemies, in an order
        // we guarantee that player will able to reach out every enemy in the list
        // according to the list's order and quantity
        // this will let players compete in a random dungeon
        // with similar difficulty
        const enemyList = this.expandEnemyConfig(this._config.enemies);
        const enemiesMeta = Game.dungeonManager.getMeta().enemies;
        console.log("enemies to place", enemyList.length);

        const maxDistanceBetweenEnemies = cells.length / enemyList.length;

        const cellsForLoot: Cell[] = [];

        const enemyStack: Cell[] = [];
        let cellStack = [start];
        const visited = {
            [this.cellToIndex(start)]: 0
        };

        let accumulatedDistance = 0;
        // move along the way, choosing random direction at the conjunction
        while (enemyList.length != 0 && cellStack.length != 0) {
            let currentCell = cellStack.pop();

            const neighbours = this.shuffle(currentCell.c).filter(x => !visited[x]);

            if (neighbours.length == 0) {
                continue;
            }

            cellStack.push(currentCell);

            for (const index of neighbours) {
                currentCell = cells[index];
                visited[index] = ++accumulatedDistance;
                cellStack.push(currentCell);

                if (accumulatedDistance >= maxDistanceBetweenEnemies) {
                    accumulatedDistance -= maxDistanceBetweenEnemies;
                    // place random enemy from difficulty
                    const difficulty = enemyList.pop();
                    const enemy = _.sample(enemiesMeta.enemiesByDifficulty[difficulty]);
                    currentCell.enemy = enemy;
                } else if (enemyStack.length != 0) {
                    cellsForLoot.push(currentCell);
                }

                break;
            }
        }

        console.log('total enemies', enemyStack.length)

        return cellsForLoot;
    }

    placeLoot(cellsForLoot: Cell[]) {
        if (!cellsForLoot.length) {
          return;
        }
        // uniformly distibute loot
        const cellsBetweenLoot = Math.abs(Math.floor((cellsForLoot.length - 1) / this._config.loot.length));
        let rewardIndex = cellsBetweenLoot;
        for (const loot of this._config.loot) {
            const cell = cellsForLoot[rewardIndex];
            rewardIndex += cellsBetweenLoot;
            let randomLoot = _.sample(this._config.loot);
            if (randomLoot) {
              cell.loot = randomLoot.items;
            }
        }
    }

    connect(cell1, cell2) {
        cell1.c.push(this.cellToIndex(cell2));
        cell2.c.push(this.cellToIndex(cell1));
    }

    async generate(): Promise<DungeonFloorData> {
        let cells = new Array(this._config.width * this._config.height);
        // pick random point as a start
        const startCell: Cell = {
            x: this.range(0, this._config.width - 1),
            y: this.range(0, this._config.height - 1),
            c: []
        };
        let stack: Cell[] = [startCell];
        cells[this.cellToIndex(startCell)] = startCell;

        while (stack.length != 0) {
            let currentCell = stack.pop();
            const neighbours = this.randomNeighbours(currentCell, c => !cells[this.cellToIndex(c)]);
            if (neighbours.length != 0) {
                stack.push(currentCell);
            } else {
                continue;
            }

            const nbCell = neighbours[0];
            const nbCellIdx = this.cellToIndex(nbCell);
            if (!cells[nbCellIdx]) {
                cells[nbCellIdx] = nbCell;
                stack.push(nbCell);
                this.connect(currentCell, nbCell);
            }
        }

        // place enemies
        const cellsForLoot = await this.placeEnemies(startCell, cells);
        this.placeLoot(cellsForLoot);

        // randomly open extra passsages
        let openChance = this._config.extraPassageChance;
        for (const cell of cells) {
            if (cell.c.length < 4) {
                const neighbours = this.randomNotConnected(cell);
                for (const nbCell of neighbours) {
                    if (this.range(1, 100) <= openChance) {
                        this.connect(cells[this.cellToIndex(nbCell)], cell);
                        openChance = this._config.missedPassageChanceInc;
                    } else {
                        openChance += this._config.extraPassageChance;
                    }
                }
            }
        }

        const dungeon: DungeonFloorData = {
            cells,
            width: this._config.width,
            height: this._config.height,
            start: startCell
        }

        return dungeon;
    }

}