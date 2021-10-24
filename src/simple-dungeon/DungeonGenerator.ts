import random from "../random";
import Game from "../game";
import { Cell, CompactedConfig, DungeonEnemiesCompact, DungeonFloorConfig, DungeonFloorData } from "./types";

export function cellToIndex(cell: Cell, width: number) {
    return cell.y * width + cell.x;
}

export class DungeonGenerator {
    private _config: DungeonFloorConfig;

    constructor(config: DungeonFloorConfig) {
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

    expandConfig<T extends CompactedConfig>(configs: T[]): T[] {
        const list = [];
        for (let k = configs.length - 1; k >= 0; --k) {
            const config = configs[k];
            for (let i = 0; i < config.count; ++i) {
                list.push(config);
            }
        }

        return list;
    }

    async placeEnemies(start: Cell, cells: Cell[]) {
        return [...cells];

        const enemiesMeta = Game.dungeonManager.getMeta();

        // first, place main enemies, in an order
        // we guarantee that player will able to reach out every enemy in the list
        // according to the list's order and quantity
        // this will let players compete in a random dungeon
        // with similar difficulty
        const enemyList = this.expandConfig(this._config.enemies);
        console.log("enemies to place", enemyList.length);

        const maxDistanceBetweenEnemies = cells.length / enemyList.length;

        const freeCells: Cell[] = [];

        const enemyStack: Cell[] = [];
        const startCellIndex = this.cellToIndex(start);
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

                if (index != startCellIndex && accumulatedDistance >= maxDistanceBetweenEnemies) {
                    accumulatedDistance -= maxDistanceBetweenEnemies;
                    // place random enemy from difficulty
                    const { difficulty } = enemyList.pop();
                    currentCell.enemy = {
                        ...random.pick(enemiesMeta.enemies.enemiesByDifficulty[difficulty])
                    };
                } else {
                    freeCells.push(currentCell);
                }

                break;
            }
        }

        console.log('total enemies', enemyStack.length)

        return freeCells;
    }

    placeTraps(freeCells: Cell[]) {
        if (freeCells.length == 0) {
            return freeCells;
        }

        const altars = this.expandConfig(this._config.traps);

        for (const altar of altars) {
            const cellIndex = random.intRange(0, freeCells.length - 1);
            const cell = freeCells[cellIndex];
            cell.altar = {
                id: altar.id
            };

            freeCells[cellIndex] = freeCells[freeCells.length - 1];
            freeCells.pop();
        }

        return freeCells;
    }

    placeAltars(freeCells: Cell[]) {
        if (freeCells.length == 0) {
            return freeCells;
        }

        const altars = this.expandConfig(this._config.altars);

        for (const altar of altars) {
            const cellIndex = random.intRange(0, freeCells.length - 1);
            const cell = freeCells[cellIndex];
            cell.altar = {
                id: altar.id
            };

            freeCells[cellIndex] = freeCells[freeCells.length - 1];
            freeCells.pop();
        }

        return freeCells;
    }

    placeLoot(freeCells: Cell[]) {
        if (freeCells.length == 0) {
            return freeCells;
        }

        for (const loot of this._config.loot) {
            const cellIndex = random.intRange(0, freeCells.length - 1);
            const cell = freeCells[cellIndex];
            cell.loot = loot;

            freeCells[cellIndex] = freeCells[freeCells.length - 1];
            freeCells.pop();
        }

        return freeCells;
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
        let freeCells = await this.placeEnemies(startCell, cells);
        // freeCells = this.placeLoot(freeCells);
        // freeCells = this.placeAltars(freeCells);
        // freeCells = this.placeTraps(freeCells);

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
            start: startCell
        }

        return dungeon;
    }

}