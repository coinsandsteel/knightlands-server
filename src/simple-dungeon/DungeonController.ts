import { Collection } from "mongodb";
import { Collections } from "../database/database";
import Game from "../game";
import User from "../user";
import { DungeonGenerator } from "./DungeonGenerator";
import { DungeonClientState, DungeonSaveData } from "./types";

export class DungeonController {
    private _user: User;
    private _saveData: DungeonSaveData;
    private _saveCollection: Collection;

    constructor(user: User) {
        this._user = user;
        this._saveCollection = Game.db.collection(Collections.HalloweenUsers);
    }

    async init() {
        const saveData = await this._saveCollection.findOne({ _id: this._user.id });
        if (saveData) {
            this._saveData = saveData as DungeonSaveData;
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
                energy: meta.mode.maxEnergy,
                floor,
                revealed: [dungeonData.start],
                cycle: this._user.getDailyRewardCycle()
            },
            data: dungeonData
        }

        await this._saveCollection.updateOne({ _id: this._user.id }, { $set: this._saveData }, { upsert: true });

        return this.getState();
    }

    getState(): DungeonClientState {
        return this._saveData.state;
    }

    async reveal(cellId: number) {

    }

    /**
     * Move if empty
     * Collect loot
     * Attack enemy
     * 
     * @param cellId 
     * 
     */
    async activateCell(cellId: number) {

    }
}