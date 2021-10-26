import { Collection, ObjectId } from "mongodb";
import { Collections } from "../database/database";
import Game from "../game";
import { AltarType, CombatAction } from "../knightlands-shared/dungeon_types";
import errors from "../knightlands-shared/errors";
import events from "../knightlands-shared/events";
import random from "../random";
import User from "../user";
import { CombatOutcome, DungeonCombat } from "./DungeonCombat";
import { DungeonEvents } from "./DungeonEvents";
import { DungeonGenerator, cellToIndex } from "./DungeonGenerator";
import { DungeonUser } from "./DungeonUser";
import { Cell, CellEnemy, DungeonAltarTile, DungeonClientData, DungeonLootTile, DungeonSaveData, DungeonTrapTile, EnemyData } from "./types";

export class DungeonController {
    private _user: User;
    private _dungeonUser: DungeonUser;
    private _saveData: DungeonSaveData;
    private _saveCollection: Collection;
    private _revealedLookUp: { [key: number]: number };
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
            this.initPlayer();
        }

        // if day is finished - generate new dungeon
        if (!this._saveData || this._saveData.state.cycle != this._user.getDailyRewardCycle()) {
            await this.generateNewFloor();
        }

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
        await Game.dungeonManager.init();

        const meta = Game.dungeonManager.getMeta();

        let floor = 1;
        let userState = {
            level: 1,
            energy: meta.mode.dailyEnergy,
            cell: 0,
            health: 1000,
            lastHpRegen: Game.nowSec,
            lastEnergyRegen: Game.nowSec,
            key: 0,
            potion: 0,
            scroll: 0,
            exp: 0,
            stats: {
                str: 0,
                dex: 0,
                int: 0,
                sta: 0
            }
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
                mapRevealed: false,
                revealed: [cellToIndex(dungeonData.start, dungeonData.width)],
                cycle: this._user.getDailyRewardCycle(),
                user: userState,
                defRevealed: 0,
                defHidden: 0
            },
            data: dungeonData
        }

        await this._saveCollection.updateOne({ _id: this._user.id }, { $set: this._saveData }, { upsert: true });

        this.indexRevealedCells();

        this.initPlayer();

        this._dungeonUser.resetHealth();
        this._dungeonUser.resetEnergy();

        return this.getState();
    }

    getState(): DungeonClientData {
        const revealed = Object.keys(this._revealedLookUp).map(x => this.getCell(x as unknown as number));

        const state: DungeonClientData = {
            floor: this._saveData.state.floor,
            user: this._saveData.state.user,
            revealed,
            width: this._saveData.data.width,
            height: Math.round(this._saveData.data.cells.length / this._saveData.data.width)
        };

        if (this._saveData.state.combat) {
            state.combat = {
                enemyHealth: this._saveData.state.combat.enemyHealth,
                enemyId: this._saveData.state.combat.enemyId
            };
        }

        return state;
    }

    // reveal and move 
    async reveal(cellId: number) {
        await this.assertNotInCombat();

        const targetCell = this.getCell(cellId);
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

        const meta = Game.dungeonManager.getMeta();
        this.consumeEnergy(meta.costs.reveal);

        this._revealedLookUp[cellId] = this._saveData.state.revealed.push(cellId) - 1;

        this.moveToCell(cellId);

        if (targetCell.enemy) {
            const enemyData = meta.enemies.enemiesById[targetCell.enemy.id];
            if (enemyData.isAggressive) {
                // throw into combat right away
                this.startCombat(targetCell.enemy);
            }
        }

        if (targetCell.trap) {
            this.triggerTrap(targetCell);
        }

        this._events.cellRevealed(targetCell);
        this._events.flush();
    }

    async moveTo(cellId: number) {
        await this.assertNotInCombat();

        const targetCell = this.getRevealedCell(cellId);

        if (!targetCell) {
            throw errors.IncorrectArguments;
        }

        const meta = Game.dungeonManager.getMeta();
        this.consumeEnergy(meta.costs.move);

        if (targetCell.trap) {
            this.triggerTrap(targetCell);
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

        const targetCell = this.getRevealedCell(cellId);

        if (!targetCell) {
            throw errors.IncorrectArguments;
        }

        const meta = Game.dungeonManager.getMeta();

        if (targetCell.enemy) {
            this.consumeEnergy(meta.costs.enemy);
            this.startCombat(targetCell.enemy);
        } else if (targetCell.altar) {
            this.consumeEnergy(meta.costs.altar);
            this.useAltar(targetCell);
        } else if (targetCell.trap) {
            this.consumeEnergy(meta.costs.trap);
            this.defuseTrap(targetCell);
        }

        this._events.flush();
    }

    async combatAction(action, data) {
        if (!this._saveData.state.combat) {
            throw errors.IncorrectArguments;
        }

        switch (action) {
            case CombatAction.Attack:
                const outcome = this._combat.resolveOutcome(data.move);
                const cell = this.getRevealedCell(this._dungeonUser.position);
                const enemyData = Game.dungeonManager.getEnemyData(cell.enemy.id);

                if (outcome == CombatOutcome.EnemyWon) {
                    // save enemy health if enemy is non-agressive
                    if (!enemyData.isAggressive) {
                        cell.enemy.health = this._combat.enemyHealth;
                    }

                    this.killPlayer(this._combat.enemyId);
                } else if (outcome == CombatOutcome.PlayerWon) {
                    // delete enemy
                    delete cell.enemy;
                    // get rewards
                    this._dungeonUser.addExp(Game.dungeonManager.getMeta().enemies.difficultyExperience[enemyData.difficulty]);
                }

                if (outcome != CombatOutcome.NobodyWon) {
                    // reset combat
                    this._saveData.state.combat = null;
                }
                break;

            case CombatAction.SwapEquipment:

                break;
        }

        this._events.flush();
    }

    private killPlayer(enemyId: number) {
        // reset player position
        this._dungeonUser.moveTo(this.cellToIndex(this._saveData.data.start));
        // refill his health
        this._dungeonUser.resetHealth();

        const enemyData = Game.dungeonManager.getEnemyData(enemyId);
        if (enemyData.isAggressive) {
            // reset enemy hp
            const cell = this.getRevealedCell(this._dungeonUser.position);
            cell.enemy.health = enemyData.health;
        }
    }

    private getCell(cellId: number) {
        return this._saveData.data.cells[cellId];
    }

    private getRevealedCell(cellId: number) {
        const cell = this.getCell(cellId);
        return this._revealedLookUp[cellId] !== undefined ? cell : undefined;
    }

    private consumeEnergy(energyNeed: number) {
        if (this._dungeonUser.energy < energyNeed) {
            throw errors.NoEnergy;
        }

        this._dungeonUser.modifyEnergy(-energyNeed);
    }

    private startCombat(enemy: CellEnemy) {
        this._saveData.state.combat = this._combat.start(enemy.id, enemy.health);
        this._events.combatStarted(this._saveData.state.combat);
    }

    private async assertNotInCombat() {
        if (this._saveData.state.combat) {
            throw errors.SDungeonInCombat;
        }
    }

    private async collectLoot(loot: DungeonLootTile) {

    }

    private triggerTrap(cell: Cell) {
        const meta = Game.dungeonManager.getMeta();

        // determine jamming chance
        const mapRevealed = this._saveData.state.mapRevealed;
        const chanceIndex = mapRevealed ? this._saveData.state.defRevealed : this._saveData.state.defHidden;
        const jamminChance = meta.traps.jammingChance;
        const chances = jamminChance[Math.min(jamminChance.length - 1, chanceIndex)];
        const chance = mapRevealed ? chances.revealed : chances.hidden;
        if (random.intRange(1, 100) <= chance) {
            // jammed, reset jamming counter
            if (mapRevealed) {
                this._saveData.state.defRevealed = 0;
            } else {
                this._saveData.state.defHidden = 0;
            }
            this._events.trapJammed(this._revealedLookUp[this.cellToIndex(cell)]);
        }

        delete cell.trap;
    }

    private moveToCell(cellId: number) {
        const targetCell = this.getRevealedCell(cellId);

        if (!targetCell) {
            throw errors.IncorrectArguments;
        }

        this._dungeonUser.moveTo(cellId);
    }

    private defuseTrap(cell: Cell) {
        const meta = Game.dungeonManager.getMeta();
        const trapData = meta.traps.traps[cell.trap.id];
        // use item if any
        this._dungeonUser.defuseTrap(trapData);
        this._events.trapJammed(this._revealedLookUp[this.cellToIndex(cell)]);
    }

    private useAltar(cell: Cell) {
        const meta = Game.dungeonManager.getMeta();
        const altarData = meta.altars.altars[cell.altar.id];

        this._dungeonUser.applyAltar(altarData);
        delete cell.altar;
        this._events.altarApplied(this._revealedLookUp[this.cellToIndex(cell)]);
    }

    private indexRevealedCells() {
        this._revealedLookUp = {};

        let index = 0;
        for (const cellId of this._saveData.state.revealed) {
            this._revealedLookUp[cellId] = index;
            index++;
        }
    }

    private cellToIndex(cell: Cell) {
        return cellToIndex(cell, this._saveData.data.width);
    }

    private initPlayer() {
        if (!this._dungeonUser) {
            this._dungeonUser = new DungeonUser(this._saveData.state.user, this._events, Game.dungeonManager.getMeta().progression);
            this._combat = new DungeonCombat(this._dungeonUser, this._events);
        }
    }
}