import { Collection } from "mongodb";
import { Collections } from "../database/database";
import Game from "../game";
import { AltarType, CombatAction } from "../knightlands-shared/dungeon_types";
import errors from "../knightlands-shared/errors";
import events from "../knightlands-shared/events";
import User from "../user";
import { DungeonCombat } from "./DungeonCombat";
import { DungeonEvents } from "./DungeonEvents";
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
    private _events: DungeonEvents;

    constructor(user: User) {
        this._events = new DungeonEvents(user.id);
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

        this._dungeonUser = new DungeonUser(this._saveData.state.user, this._events);
        this._combat = new DungeonCombat(this._dungeonUser, this._events);

        if (this._saveData.state.combat) {
            this._combat.load(this._saveData.state.combat);
        }
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
            cell: 0,
            health: 1000,
            lastHpRegen: Game.nowSec,
            lastEnergyRegen: Game.nowSec
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
                user: userState,
                defuseFails: 0
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

        this.moveToCell(cellId);

        if (targetCell.trap) {
            this.setOnTrap(targetCell.trap);
        } else if (targetCell.loot) {
            await this.collectLoot(targetCell.loot);
        }

        this._events.cellRevealed(targetCell);

        this._events.flush();
    }

    async moveTo(cellId: number) {
        await this.assertNotInCombat();

        const targetCell = this._saveData.data.cells[cellId];

        if (!targetCell || !this._revealedLookUp[cellId]) {
            throw errors.IncorrectArguments;
        }

        this.moveToCell(cellId);

        this._events.flush();
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
        } else if (targetCell.trap) {
            // try to difuse
            this.defuseTrap(targetCell.trap);
        }

        this._events.flush();
    }

    async combatAction(action, data) {
        switch (action) {
            case CombatAction.Attack:
                this._combat.resolveOutcome(data.move);
                break;

            case CombatAction.SwapEquipment:

                break;
        }

        this._events.flush();
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
    }

    private defuseTrap(trapTile: DungeonTrapTile) {
        const meta = Game.dungeonManager.getMeta();
        const trapData = meta.traps.traps[trapTile.id];

        // use item if have

        // try your luck otherwise

    }

    private useAltar(altarTile: DungeonAltarTile) {
        const meta = Game.dungeonManager.getMeta();
        const altarData = meta.altars.altars[altarTile.id];

        this._dungeonUser.applyAltar(altarData);
    }

    private indexRevealedCells() {
        const width = this._saveData.data.width;

        this._revealedLookUp = {};

        for (const cell of this._saveData.state.revealed) {
            this._revealedLookUp[cellToIndex(cell, width)] = true;
        }
    }
}