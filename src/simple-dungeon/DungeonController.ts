import { Collection } from "mongodb";
import { Collections } from "../database/database";
import Game from "../game";
import errors from "../knightlands-shared/errors";
import User from "../user";
import { DungeonGenerator, cellToIndex } from "./DungeonGenerator";
import { DungeonClientState, DungeonSaveData } from "./types";

export class DungeonController {
    private _user: User;
    private _saveData: DungeonSaveData;
    private _saveCollection: Collection;
    private _revealedLookUp: { [key: number]: true };

    constructor(user: User) {
        this._user = user;
        this._saveCollection = Game.db.collection(Collections.HalloweenUsers);
        this._revealedLookUp = {};
    }

    async init() {
        const saveData = await this._saveCollection.findOne({ _id: this._user.id });
        if (saveData) {
          this._saveData = saveData as DungeonSaveData;
        } else {
          await this.generateNewFloor();
        }

        const width = this._saveData.data.width;
        for (const cell of this._saveData.state.revealed) {
            this._revealedLookUp[cellToIndex(cell, width)] = true;
        }
    }

    async generateNewFloor() {
        let floor = 1;
        if (this._saveData) {
            floor = this._saveData.state.floor;
        }

        const meta = Game.dungeonManager.getMeta();
        const dungeon = new DungeonGenerator(meta.dungeons.floors[floor - 1]);
        const dungeonData = await dungeon.generate();

        this._saveData = {
            state: {
                width: dungeonData.width,
                height: dungeonData.height,
                energy: meta.mode.maxEnergy,
                floor,
                revealed: [dungeonData.start],
                cycle: this._user.getDailyRewardCycle()
            },
            data: dungeonData
        }

        await this._saveCollection.updateOne({ _id: this._user.id }, { $set: this._saveData }, { upsert: true });
    }

    getState(): DungeonClientState {
        return this._saveData.state;
    }

    async reveal(cellId: number) {
        const targetCell = this._saveData.data.cells[cellId];
        const targetCellIdx = cellToIndex(targetCell, this._saveData.data.width);

        if (!targetCell || this._revealedLookUp[targetCellIdx]) {
            throw errors.IncorrectArguments;
        }

        let correctReveal = false;
        // check if this cell has connection to any revealed cell
        for (const cellIdx of targetCell.c) {
            if (this._revealedLookUp[cellIdx]) {
                correctReveal = true;
                break;
            }
        }

        if (!correctReveal) {
            throw errors.IncorrectArguments;
        }

        await this._saveCollection.updateOne({ _id: this._user.id }, { $push: { "state.revealed": targetCell } });

        this._saveData.state.revealed.push(targetCell);
        this._revealedLookUp[targetCellIdx] = true;

        return targetCell;
    }

    /**
     * Collect loot
     * Attack enemy
     * 
     * @param cellId 
     * 
     */
    async useCell(cellId: number) {
        const targetCell = this._saveData.data.cells[cellId];
        const targetCellIdx = cellToIndex(targetCell, this._saveData.data.width);

        if (!targetCell || !this._revealedLookUp[targetCellIdx]) {
            throw errors.IncorrectArguments;
        }


    }
}