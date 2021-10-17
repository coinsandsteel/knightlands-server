import random from "../random";
import Game from "../game";
import { Cell, DungeonEnemiesCompact, DungeonFloorConfig, DungeonFloorData } from "./types";

export class DungeonGenerator {
    private _config: DungeonFloorConfig;

    constructor(config: DungeonFloorConfig) {
        this._config = config;
    }

    range(min: number, max: number) {
        return random.intRange(min, max);
    }

    cellToIndex(cell: Cell) {
        return cell.y * this._config.width + cell.x;
    }

    shuffle(cells: number[]) {
        for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cells[i], cells[j]] = [cells[j], cells[i]];
        }

        return cells;
    }

    randomNeighbours(cell: Cell, filter: (cell: Cell) => boolean) {
        const cells = [];
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
        for (let k = enemiesConfig.length - 1; k >= 0; --k) {
            const config = enemiesConfig[k];
            for (let i = 0; i < config.count; ++i) {
                enemyList.push({ difficulty: config.difficulty });
            }
        }

        return enemyList;
    }

    async placeEnemies(start: Cell, cells: Cell[]) {
        const enemiesMeta = Game.dungeonManager.getMeta();

        // first, place main enemies, in an order
        // we guarantee that player will able to reach out every enemy in the list
        // according to the list's order and quantity
        // this will let players compete in a random dungeon
        // with similar difficulty
        const enemyList = this.expandEnemyConfig(this._config.enemies.ordered);
        console.log("enemies to place", enemyList.length);

        const maxDistanceBetweenEnemies = Math.round((cells.length - 1) / enemyList.length);
        console.log("maxDistanceBetweenEnemies", maxDistanceBetweenEnemies);

        const cellsForLoot: Cell[] = [];

        const enemyStack: Cell[] = [];
        let cellStack = [start];
        const visited = {
            [this.cellToIndex(start)]: 0
        };

        // move along the way, choosing random direction at the conjunction
        while (enemyList.length != 0 && cellStack.length != 0) {
            let currentCell = cellStack.pop();
            let accumulatedDistance = visited[this.cellToIndex(currentCell)];

            const neighbours = this.shuffle(currentCell.c);

            if (neighbours.length == 0) {
                continue;
            }

            for (const index of neighbours) {
                if (visited[index]) {
                    continue;
                }

                currentCell = cells[index];
                visited[index] = ++accumulatedDistance;
                cellStack.push(currentCell);

                if (accumulatedDistance % maxDistanceBetweenEnemies == 0) {
                    // place enemy
                    currentCell.enemy = enemyList.pop();
                } else if (enemyStack.length != 0) {
                    cellsForLoot.push(currentCell);
                }
            }
        }

        console.log('total enemies', enemyStack.length)

        return cellsForLoot;
    }

    placeLoot(cellsForLoot: Cell[]) {
        // uniformly distibute loot
        const cellsBetweenLoot = Math.floor((cellsForLoot.length - 1) / this._config.loot.ordered.length);
        let rewardIndex = cellsBetweenLoot;
        for (const loot of this._config.loot.ordered) {
            const cell = cellsForLoot[rewardIndex];
            rewardIndex += cellsBetweenLoot;
            cell.loot = loot;
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

            const nbCellIdx = neighbours[0];
            if (!cells[nbCellIdx]) {
                const nbCell = cells[nbCellIdx];
                cells[nbCellIdx] = nbCell;
                stack.push(nbCell);
                this.connect(currentCell, nbCell);
            }
        }

        // randomly open extra passsages
        let openChance = this._config.extraPassageChance;
        for (const cell of cells) {
            if (cell.c.length < 4) {
                const neighbours = this.randomNotConnected(cell);
                for (const nbCellIdx of neighbours) {
                    if (this.range(1, 100) <= openChance) {
                        this.connect(cells[nbCellIdx], cell);
                        openChance = this._config.missedPassageChanceInc;
                    } else {
                        openChance += this._config.extraPassageChance;
                    }
                }
            }
        }

        // place enemies
        const cellsForLoot = await this.placeEnemies(startCell, cells);
        this.placeLoot(cellsForLoot);

        const dungeon: DungeonFloorData = {
            cells,
            start: startCell
        }

        return dungeon;
    }

}