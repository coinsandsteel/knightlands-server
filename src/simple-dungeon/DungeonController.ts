import { Collection } from "mongodb";
import { Collections } from "../database/database";
import Game from "../game";
import { AltarType, CombatAction } from "../knightlands-shared/dungeon_types";
import errors from "../knightlands-shared/errors";
import events from "../knightlands-shared/events";
import User from "../user";
import { DungeonCombat } from "./DungeonCombat";
import { DungeonGenerator, cellToIndex } from "./DungeonGenerator";
import { DungeonUser } from "./DungeonUser";
import { DungeonAltarTile, DungeonClientData, DungeonLootTile, DungeonSaveData, DungeonTrapTile } from "./types";

export class DungeonController {
    private _user: User;
    private _dungeonUser: DungeonUser;
    private _saveData: DungeonSaveData;
    private _saveCollection: Collection;
    private _revealedLookUp: { [key: number]: true };
    private _combat: DungeonCombat;
    private _eventObject: any;

    constructor(user: User) {
        this._eventObject = {};
        this._user = user;
        this._saveCollection = Game.db.collection(Collections.HalloweenUsers);
        this._revealedLookUp = {};
    }

    async init() {
        const saveData = await this._saveCollection.findOne({ _id: this._user.id });
        if (saveData) {
            this._saveData = saveData as DungeonSaveData;

            this.indexRevealedCells();
        } else {
            await this.generateNewFloor();
        }

        this._dungeonUser = new DungeonUser(this._saveData.state.user);
        this._combat = new DungeonCombat(this._dungeonUser);

        if (this._saveData.state.combat) {
            this._combat.load(this._saveData.state.combat);
        }
    }

    flushEvents() {
        Game.emitPlayerEvent(this._user.id, events.SDungeonUpdate, this._eventObject);
        this._eventObject = {};
    }

    async dispose() {
        // flush data
        await this._saveCollection.updateOne({ _id: this._user.id }, { $set: this._saveData }, { upsert: true });
    }

    async load() {
        return this.getState();
    }

    async generateNewFloor() {
        const meta = Game.dungeonManager.getMeta();

        let floor = 1;
        let userState = {
            level: 1,
            energy: meta.mode.dailyEnergy,
            cell: 0
        }

        if (this._saveData) {
            floor = this._saveData.state.floor;
            userState = this._saveData.state.user;
        }

        const dungeon = new DungeonGenerator(meta.dungeons.floors[floor - 1]);
        const dungeonData = await dungeon.generate();

        userState.cell = cellToIndex(dungeonData.start, dungeonData.width);

        this._saveData = {
            state: {
                floor,
                revealed: [dungeonData.start],
                cycle: this._user.getDailyRewardCycle(),
                user: userState
            },
            data: dungeonData
        }

        await this._saveCollection.updateOne({ _id: this._user.id }, { $set: this._saveData }, { upsert: true });

        this.indexRevealedCells();

        return this.getState();
    }

    getState(): DungeonClientData {
        return {
            ...this._saveData.state,
            width: this._saveData.data.width,
            height: Math.round(this._saveData.data.cells.length / this._saveData.data.width)
        };
    }

    // reveal and move 
    async reveal(cellId: number) {
        await this.assertNotInCombat();

        const targetCell = this._saveData.data.cells[cellId];

        if (!targetCell || this._revealedLookUp[cellId]) {
            throw errors.IncorrectArguments;
        }

        let correctReveal = false;
        // check if this cell has connection to the cell where player currently is standing
        const currentCellIndex = this._dungeonUser.position;
        for (const cellIdx of targetCell.c) {
            if (cellIdx == currentCellIndex) {
                correctReveal = true;
                break;
            }
        }

        if (!correctReveal) {
            throw errors.IncorrectArguments;
        }

        await this._saveCollection.updateOne({ _id: this._user.id }, { $push: { "state.revealed": targetCell } });

        this._saveData.state.revealed.push(targetCell);
        this._revealedLookUp[cellId] = true;

        if (!targetCell.enemy && !targetCell.altar) {
            // anything than enemy and altar does not block the player from moving
            this.moveToCell(cellId);

            if (targetCell.trap) {
                this.setOnTrap(targetCell.trap);
            } else if (targetCell.loot) {
                await this.collectLoot(targetCell.loot);
            }
        }

        this._eventObject.cell = targetCell;

        this.flushEvents();
    }

    /**
     * Collect loot
     * Attack enemy
     * 
     * @param cellId 
     * 
     */
    async useCell(cellId: number) {
        await this.assertNotInCombat();

        const targetCell = this._saveData.data.cells[cellId];

        if (!targetCell || !this._revealedLookUp[cellId]) {
            throw errors.IncorrectArguments;
        }

        const meta = Game.dungeonManager.getMeta();

        if (targetCell.enemy) {
            // enter combat
            this._saveData.state.combat = this._combat.start(meta.enemies.enemiesById[targetCell.enemy.id]);
        } else if (targetCell.altar) {
            // use altar
            this.useAltar(targetCell.altar);
        } else {
            // nothing here - just move
            this.moveToCell(cellId);
        }

        this.flushEvents();
    }

    async combatAction(action, data) {
        switch (action) {
            case CombatAction.Attack:
                this._combat.resolveOutcome(data.move);
                break;

            case CombatAction.SwapEquipment:

                break;
        }

        this.flushEvents();
    }

    private async assertNotInCombat() {
        if (this._saveData.state.combat) {
            throw errors.SDungeonInCombat;
        }
    }

    private async collectLoot(loot: DungeonLootTile) {

    }

    private setOnTrap(trap: DungeonTrapTile) {

    }

    private moveToCell(cellId: number) {
        const targetCell = this._saveData.data.cells[cellId];

        if (!targetCell || !this._revealedLookUp[cellId]) {
            throw errors.IncorrectArguments;
        }

        this._dungeonUser.moveTo(cellId);
        this._eventObject.moveTo = cellId;
    }

    private useAltar(altarTile: DungeonAltarTile) {
        const meta = Game.dungeonManager.getMeta();
        const altarData = meta.altars.altars[altarTile.id];

        this._dungeonUser.useAltar(altarData);
    }

    private indexRevealedCells() {
        const width = this._saveData.data.width;

        this._revealedLookUp = {};

        for (const cell of this._saveData.state.revealed) {
            this._revealedLookUp[cellToIndex(cell, width)] = true;
        }
    }
}