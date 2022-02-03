import { BinaryHeap } from "../../utils/BinaryHeap";
import { DungeonController } from "./DungeonController";
import { Cell } from "./types";

function pathTo(node: GNode) {
    var curr = node;
    var path = [];
    while (curr.parent) {
        path.push(curr.cell);
        curr = curr.parent;
    }
    return path;
}

class GNode {
    public cell: Cell;
    public h: number;
    public g: number;
    public f: number;
    public parent: GNode;
    public visited: boolean;
    public closed: boolean;

    constructor(cell: Cell) {
        this.cell = cell;
    }

    reset() {
        this.h = 0;
        this.g = 0;
        this.f = 0;
        this.closed = false;
        this.parent = null;
        this.visited = false;
    }
}

function getHeap() {
    return new BinaryHeap(function (node) {
        return node.f;
    });
}

export class AStar {
    private _nodes: { [key: number]: GNode };

    constructor() {
        this.reset();
    }

    reset() {
        this._nodes = {};
    }

    cache(cells: Cell[]) {
        for (let i = 0, l = cells.length; i < l; ++i) {
            this._nodes[i] = new GNode(cells[i]);
        }
    }

    /**
    * Perform an A* Search on a graph given a start and end node.
    * @param {Graph} graph
    * @param {Cell} start
    * @param {Cell} end
    */
    search(graph: DungeonController, start: Cell, end: Cell) {
        for (const id in this._nodes) {
            this._nodes[id].reset();
        }

        var heuristic = function (pos0: Cell, pos1: Cell) {
            var d1 = Math.abs(pos1.x - pos0.x);
            var d2 = Math.abs(pos1.y - pos0.y);
            return d1 + d2;
        };
        var closest = false;

        var openHeap = getHeap();

        const startNode = this._nodes[graph.cellToIndex(start)];
        startNode.h = heuristic(start, end);

        openHeap.push(startNode);

        while (openHeap.size() > 0) {
            // Grab the lowest f(x) to process next.  Heap keeps this sorted for us.
            var currentNode = openHeap.pop() as GNode;

            // End case -- result has been found, return the traced path.
            if (currentNode.cell === end) {
                return pathTo(currentNode);
            }

            currentNode.closed = true;

            // Normal case -- move currentNode from open to closed, process each of its neighbors.

            // Find all neighbors for the current node.
            for (const cellId of currentNode.cell.c) {
                var neighbor = this._nodes[cellId];

                if (!neighbor || neighbor.closed) {
                    continue;
                }

                // The g score is the shortest distance from start to current node.
                // We need to check if the path we have arrived at this neighbor is the shortest one we have seen yet.
                var gScore = currentNode.g + (graph.isRevealed(cellId) ? 1 : 9999);
                var beenVisited = neighbor.visited;

                if (!beenVisited || gScore < neighbor.g) {
                    // Found an optimal (so far) path to this node.  Take score for node to see how good it is.
                    neighbor.visited = true;
                    neighbor.parent = currentNode;
                    neighbor.h = neighbor.h || heuristic(neighbor.cell, end);
                    neighbor.g = gScore;
                    neighbor.f = neighbor.g + neighbor.h;

                    if (!beenVisited) {
                        // Pushing to heap will put it in proper place based on the 'f' value.
                        openHeap.push(neighbor);
                    } else {
                        // Already seen the node, but since it has been rescored we need to reorder it in the heap
                        openHeap.rescoreElement(neighbor);
                    }
                }
            }
        }

        if (closest) {
            return pathTo(startNode);
        }

        // No result was found - empty array signifies failure to find path.
        return [];
    }
};