import _ from "lodash";
import { Collection } from "mongodb";
import { isNumber } from "../../validation";
import Game from "../../game";
import { AltarType } from "../../knightlands-shared/dungeon_types";
import errors from "../../knightlands-shared/errors";
import random from "../../random";
import User from "../../user";
import { AStar } from "./AStar";
import { CombatOutcome, DungeonCombat } from "./DungeonCombat";
import { DungeonEvents } from "./DungeonEvents";
import { DungeonGenerator, cellToIndex } from "./DungeonGenerator";
import { DungeonUser } from "./DungeonUser";
import { Cell, CellEnemy, DungeonClientData, DungeonFloorConfig, DungeonSaveData } from "./types";

const IAP_TAG = "hallowen";

export class DungeonController {
    private _user: User;
    private _dungeonUser: DungeonUser;
    private _saveData: DungeonSaveData;
    private _revealedLookUp: { [key: number]: number };
    private _combat: DungeonCombat;
    private _events: DungeonEvents;
    private _aStar: AStar;

    constructor(user: User) {
        this._events = new DungeonEvents(user.id);
        this._user = user;
        this._revealedLookUp = {};
        this._aStar = new AStar();
    }

    async init() {
        const saveData = await Game.dungeonManager.loadProgress(this._user.id);
        if (saveData) {
            this._saveData = saveData as DungeonSaveData;

            this.indexRevealedCells();
            this.initPlayer();
        }

        // if day is finished - generate new dungeon
        if (!this._saveData) {
            await this.generateNewFloor();
        }

        if (this._saveData.state.user.level === -1) {
            await this.enter(true, this._saveData.state.isFree);
        }

        if (!this._saveData.data.power) {
            this._saveData.data.power = 1;
        }

        if (this._saveData.state.combat) {
            this._combat.load(this._saveData.state.combat);
        }
    }

    get isFree() {
        return this._saveData.state.isFree;
    }

    get isComplete() {
        return this._saveData.data.enemiesLeft <= 0; 
    }

    async getEntranceStatus() {
        const userId = this._user.id;
        return Game.paymentProcessor.fetchPaymentStatus(userId, IAP_TAG, { "context.userId": userId });
    }

    async enter(allow: boolean, isFree: boolean, chain: string = undefined, address: string = undefined) {
        if (allow) {
            this._saveData.state.floor = 1;
            this._saveData.state.user.level = 1;
            this._saveData.state.isFree = isFree;

            await this.generateNewFloor(true);
            await this._save();

            this._events.playerLevel(1);
            this._events.notFree();
            this._events.flush();
        } else if (this.isFree) {
            const { iap } = Game.dungeonManager.getMeta();
            const userId = this._user.id;
            let iapContext = {
                userId
            };

            let hasPendingPayment = await Game.paymentProcessor.hasPendingRequestByContext(userId, iapContext, IAP_TAG);
            if (hasPendingPayment) {
                return hasPendingPayment;
            }

            return Game.paymentProcessor.requestPayment( 
                userId,
                iap,
                IAP_TAG,
                iapContext,
                address,
                chain
            );
        }
    }

    async dispose() {
        // flush data
        await this._save()
    }

    async load() {
        return this.getState();
    }

    async getRank() {
        const rank = await Game.dungeonManager.getUserRank(this._user.id)
        if (await Game.dungeonManager.isClaimedReward(this._user.id)) {
            rank.claimed = true
        }

        return rank;
    }

    async generateNewFloor(force: boolean = false) {
        const meta = Game.dungeonManager.getMeta();

        let floor = 1;
        let isFree = true;
        let userState = {
            level: 0,
            energy: meta.mode.dailyEnergy,
            cell: 0,
            health: 1000,
            lastHpRegen: Game.nowSec,
            lastEnergyRegen: Game.nowSec,
            key: 0,
            potion: 0,
            scroll: 0,
            mHand: 0,
            oHand: 0,
            exp: 0,
            invis: 0,
            died: false,
            equip: [],
            stats: {
                str: 0,
                dex: 0,
                int: 0,
                sta: 0
            }
        }

        if (this._saveData) {
            floor = this._saveData.state.floor;
            isFree = this._saveData.state.isFree;
            userState = this._saveData.state.user;
        }

        let powerMultiplier = 1.0;
        let config: DungeonFloorConfig;

        if (meta.dungeons.floors.length < floor) {
            powerMultiplier += 0.1 * (floor - meta.dungeons.floors.length);
            config = meta.dungeons.floors[meta.dungeons.floors.length - 1];
        } else {
            config = meta.dungeons.floors[floor - 1];
        }

        const dungeon = new DungeonGenerator(config);
        const dungeonData = await dungeon.generate(powerMultiplier);

        if (force) {
            userState = {
                level: 1,
                energy: meta.mode.dailyEnergy,
                cell: 0,
                health: 1000,
                lastHpRegen: Game.nowSec,
                lastEnergyRegen: Game.nowSec,
                key: 0,
                mHand: 0,
                oHand: 0,
                potion: 0,
                scroll: 0,
                exp: 0,
                invis: 0,
                died: false,
                equip: [],
                stats: {
                    str: 0,
                    dex: 0,
                    int: 0,
                    sta: 0
                }
            }

            this._dungeonUser = null;
        }

        userState.cell = cellToIndex(dungeonData.start, dungeonData.width);

        this._saveData = {
            state: {
                isFree,
                floor,
                revealed: [userState.cell],
                cycle: this._user.getDailyRewardCycle(),
                user: userState,
                defRevealed: 0,
                defHidden: 0
            },
            data: dungeonData
        }

        this.indexRevealedCells();
        this.initPlayer();
        
        this._dungeonUser.resetHealth();
        this._dungeonUser.resetEnergy();
        
        this._saveData.state.user.lastEnergyRegen = Game.nowSec;
        this._saveData.state.user.lastHpRegen = Game.nowSec;

        await Game.dungeonManager.saveProgress(this._user.id, this._saveData);

        return this.getState();
    }

    getState(): DungeonClientData {
        const revealed = new Array(this._saveData.state.revealed.length);
        for (let i = 0, l = revealed.length; i < l; ++i) {
            revealed[i] = this.getCell(this._saveData.state.revealed[i]);
        }

        const meta = Game.dungeonManager.getMeta();

        const state: DungeonClientData = {
            power: this._saveData.data.power,
            isFree: this.isFree,
            startTime: meta.startTime,
            floor: this._saveData.state.floor,
            user: this._saveData.state.user,
            revealed,
            width: this._saveData.data.width,
            height: Math.round(this._saveData.data.cells.length / this._saveData.data.width),
            enemiesLeft: this._saveData.data.enemiesLeft,
            totalEnemies: this._saveData.data.totalEnemies 
        };

        if (this._saveData.state.combat) { 
            state.combat = {
                outcome: this._saveData.state.combat.outcome,
                enemyHealth: this._saveData.state.combat.enemyHealth,
                enemyId: this._saveData.state.combat.enemyId
            }; 
        }

        return state;
    }

    async nextFloor() {
        this.assertNotFinished();

        if (!this.isComplete) {
            throw errors.IncorrectArguments;
        }

        const meta = Game.dungeonManager.getMeta(); 
        const now = Game.nowSec;
        const totalFloorsAllowed = Math.ceil((now - meta.startTime) / 86400);
        if (totalFloorsAllowed <= 0 || totalFloorsAllowed <= this._saveData.state.floor) {
            throw errors.IncorrectArguments;
        }

        this._saveData.state.floor++;
        return this.generateNewFloor();
    }

    async withdrawReward(to: string) {
        return Game.dungeonManager.createOrGetWithdrawRequest(this._user.id, to);
    }

    // reveal and move 
    async reveal(cellId: number) {
        this.assertNotFinished();
        this.assertAllowedToPlayer();
        this.assertNotInCombat();
        this.assertNotInTrap();
        
        if (this._dungeonUser.revive(true)) {
            throw errors.IncorrectArguments;
        }

        this._dungeonUser.updateHealthAndEnergy();

        const targetCell = this.getCell(cellId);
        if (!targetCell || this._revealedLookUp[cellId]) {
            throw errors.IncorrectArguments;
        }

        this.checkCorrectReveal(targetCell);

        const meta = Game.dungeonManager.getMeta();
        this.consumeEnergy(meta.costs.reveal);

        const path = this._aStar.search(this, this.getRevealedCell(this._dungeonUser.position), targetCell);
        this.consumeEnergy(meta.costs.move * (path.length - 1));// do not count newly revealed cell cost

        const invisSteps = path.length;

        this.revealCell(targetCell, false);

        this.moveToCell(cellId);

        if (targetCell.enemy && !this._dungeonUser.isInvisible()) {
            const enemyData = meta.enemies.enemiesById[targetCell.enemy.id];
            if (enemyData.isAggressive) {
                // throw into combat right away
                this.startCombat(targetCell.enemy);
            }
        }

        if (targetCell.trap && !this._dungeonUser.isInvisible()) {
            this.triggerTrap(targetCell);
        }

        this._dungeonUser.updateInvisibility(invisSteps);

        this._events.flush();
    }

    async useItem(itemType: string) {
        this.assertNotFinished();
        this.assertAllowedToPlayer();
        this.assertNotInCombat();

        if (itemType != "key") {
            this.assertNotInTrap();
        }

        if (!this._dungeonUser.hasItem(itemType)) {
            throw errors.IncorrectArguments;
        }

        this._dungeonUser.updateHealthAndEnergy();

        let response = true;

        if (itemType == "scroll") {
            // reveal neighbour cells
            response = this.revealClosestCells();
        } else if (itemType == "potion") {
            // invisibility for 9 steps
            this._dungeonUser.addInvisibility(10);
            this._dungeonUser.addPotion(-1);
        } else if (itemType == "key") {
            await this.defuseTrap(this.getRevealedCell(this._dungeonUser.position), true);
        }

        this._events.flush();

        return response;
    }

    async moveTo(cellId: number) {
        this.assertNotFinished();
        this.assertAllowedToPlayer();
        this.assertNotInCombat();
        this.assertNotInTrap();

        this._dungeonUser.updateHealthAndEnergy();

        const targetCell = this.getRevealedCell(cellId);

        if (!targetCell) {
            throw errors.IncorrectArguments;
        }

        const meta = Game.dungeonManager.getMeta();
        let invisSteps = 1;

        const path = this._aStar.search(this, this.getRevealedCell(this._dungeonUser.position), targetCell);
        if (this._dungeonUser.revive(true)) {
            invisSteps += path.length;
            this.consumeEnergy(meta.costs.move);
        } else {
            this.consumeEnergy(meta.costs.move * path.length);
        }

        if (targetCell.trap) {
            this.triggerTrap(targetCell);
        }

        this.moveToCell(cellId);
        this._dungeonUser.updateInvisibility(invisSteps);
        this._dungeonUser.revive();

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
        this.assertNotFinished();
        this.assertAllowedToPlayer();

        try {
            this.assertNotInCombat();

            this._dungeonUser.updateHealthAndEnergy();

            const targetCell = this.getRevealedCell(cellId);

            if (!targetCell) {
                throw errors.IncorrectArguments;
            }

            const meta = Game.dungeonManager.getMeta();
            let response = null;

            if (targetCell.enemy) {
                this.startCombat(targetCell.enemy);
            } else if (targetCell.altar) {
                this.consumeEnergy(meta.costs.altar);
                await this.useAltar(targetCell);
            } else if (targetCell.trap) {
                this.consumeEnergy(meta.costs.trap);
                await this.defuseTrap(targetCell, true);
            } else if (targetCell.loot) {
                this.consumeEnergy(meta.costs.chest);
                response = await this.collectLoot(targetCell);
            } else if (targetCell.exit) {
                response = await this.nextFloor();
            }
            this._dungeonUser.updateInvisibility();

            return response;
        } catch (exc) {
            throw exc;
        } finally {
            this._events.flush();
        }
    }

    async equip(mHand: number, oHand: number) {
        this.assertNotFinished();
        this.assertAllowedToPlayer();

        if (!isNumber(mHand) || !isNumber(oHand)) {
            throw errors.IncorrectArguments;
        }

        if ((mHand > 0 && !this._dungeonUser.hasEquip(mHand)) || (oHand > 0 && !this._dungeonUser.hasEquip(oHand))) {
            throw errors.IncorrectArguments;
        }

        const meta = Game.dungeonManager.getMeta();
        if (mHand > 0) {
            if (meta.items[mHand].defensive) {
                throw errors.IncorrectArguments;
            }
        }
        
        if (oHand > 0) {
            if (!meta.items[oHand].defensive) {
                throw errors.IncorrectArguments;
            }
        }

        this._dungeonUser.equip(mHand, oHand);

        if (this._saveData.state.combat) {
            this._combat.resolveOutcome(-1, this._saveData.data.power); // auto damage 
        }

        this._events.flush();
    }

    async combatAction(move: number) {
        this.assertNotFinished();
        this.assertAllowedToPlayer();

        if (!this._saveData.state.combat) {
            throw errors.IncorrectArguments;
        }

        let outcomes;
        const cell = this.getRevealedCell(this._dungeonUser.position);
        const enemyData = Game.dungeonManager.getEnemyData(this._saveData.state.combat.enemyId);

        if (this._combat.enemyHealth > 0) {
            outcomes = this._combat.resolveOutcome(move, this._saveData.data.power);

            if (this._combat.outcome == CombatOutcome.EnemyWon) {
                // save enemy health if enemy is non-agressive
                if (!enemyData.isAggressive) {
                    cell.enemy.health = this._combat.enemyHealth;
                }

                this._events.enemyNotDefeated(this._revealedLookUp[this._dungeonUser.position], cell.enemy.health);
                this.killPlayer(this._combat.enemyId);
            } else if (this._combat.outcome == CombatOutcome.PlayerWon) {
                // delete enemy
                delete cell.enemy;
                // get rewards
                this._dungeonUser.addExp(Game.dungeonManager.getMeta().enemies.difficultyExperience[enemyData.difficulty - 1]);
                this._events.enemyDefeated(this._revealedLookUp[this._dungeonUser.position]);
                this._saveData.data.enemiesLeft--;
                await this.increaseRank(enemyData.difficulty);
            }

            if (this._combat.outcome != CombatOutcome.NobodyWon) {
                // reset combat
                this._events.combatFinished(this._saveData.state.combat.outcome);
                this._saveData.state.combat = null;
                this._dungeonUser.updateHealthAndEnergy(true);
            }
        } else {
            this._saveData.data.enemiesLeft--;
            this._dungeonUser.addExp(Game.dungeonManager.getMeta().enemies.difficultyExperience[enemyData.difficulty - 1]);
            this._events.enemyDefeated(this._revealedLookUp[this._dungeonUser.position]);
            this._events.combatFinished(CombatOutcome.PlayerWon);
            this._saveData.state.combat = null;
            this._dungeonUser.updateHealthAndEnergy(true);
            outcomes = { 
                enemyMove: 0
            }
        }
        

        this._events.flush();

        return outcomes;
    }

    estimateEnergy(cellId: number) {
        this.assertNotFinished();

        let targetCell = this.getRevealedCell(cellId);

        const meta = Game.dungeonManager.getMeta();
        let energyRequired = 0;
        if (!targetCell) {
            if (this._dungeonUser.revive(true)) {
                throw errors.IncorrectArguments;
            }
            targetCell = this.getCell(cellId);
            this.checkCorrectReveal(targetCell);

            energyRequired += meta.costs.reveal;
        }

        const finalPath = [];

        const path = this._aStar.search(this, this.getRevealedCell(this._dungeonUser.position), targetCell);
        let invisStep = 0;
        for (let i = path.length - 1; i >= 0; --i) {
            finalPath.push(this.cellToIndex(path[i]));

            if (path[i].trap && !this._dungeonUser.isInvisible(invisStep)) {
                // trap has caught you
                break;
            }

            invisStep++;
        }

        if (this._dungeonUser.revive(true)) {
            energyRequired = meta.costs.move;
        } else {
            energyRequired += (finalPath.length * meta.costs.move - energyRequired);
        }
        
        return {
            energyRequired,
            path: finalPath
        };
    }

    testAction(action: string) {
        if (action == "energy") {
            this._dungeonUser.modifyEnergy(10);
        }

        this._events.flush();
    }

    commitStats(stats: object) {
        const passedStats = _.pick(stats, ['str','dex','int','sta']);
        const statsSum = _.sum(Object.values(passedStats));
        
        // Regular update
        if (statsSum !== 0) {
          if (!this._dungeonUser.canUpdateStats(statsSum)) {
            throw errors.IncorrectArguments;
          }
        // Rebalance
        } else {
          if (this._dungeonUser.energy < 40) {
            throw errors.NoEnergy;
          }
          this._dungeonUser.modifyEnergy(-40);
        }

        this._dungeonUser.changeStats(passedStats);
        this._events.flush();
    }

    private checkCorrectReveal(targetCell: Cell) {
        let correctReveal = false;
        // check if this cell has connection to any revealed cell
        for (const cellIdx of targetCell.c) {
            if (this._revealedLookUp[cellIdx] !== undefined) {
                correctReveal = true;
                break;
            }
        }

        if (!correctReveal) {
            throw errors.IncorrectArguments;
        }
    }

    private killPlayer(enemyId: number) {
        this._dungeonUser.die(this.cellToIndex(this._saveData.data.start));

        const enemyData = Game.dungeonManager.getEnemyData(enemyId);
        if (enemyData.isAggressive) {
            // reset enemy hp
            const cell = this.getRevealedCell(this._dungeonUser.position);
            cell.enemy.health = enemyData.health;
        }
    }

    private revealCell(cell: Cell, forced: boolean) {
        if (forced) {
            cell.r = true;
        }
        const cellId = this.cellToIndex(cell);
        this._revealedLookUp[cellId] = this._saveData.state.revealed.push(cellId) - 1;
        this._events.cellRevealed(cell);
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
        const enemyData = Game.dungeonManager.getEnemyData(enemy.id);
        const meta = Game.dungeonManager.getMeta();
        this.consumeEnergy(enemyData.difficulty * meta.costs.enemy);

        this._saveData.state.combat = this._combat.start(enemy.id, enemy.health);
        this._events.combatStarted(this._saveData.state.combat);
    }

    private assertNotInCombat() {
        if (this._saveData.state.combat) {
            throw errors.SDungeonInCombat;
        }
    }

    private assertNotInTrap() {
        if (!this._dungeonUser.isInvisible()) {
            const currentCell = this.getRevealedCell(this._dungeonUser.position);
            if (currentCell.trap) {
                throw errors.SDungeonInTrap;
            }
        }
    }

    private async collectLoot(cell: Cell) {
        const meta = Game.dungeonManager.getMeta();
        let config: DungeonFloorConfig;
        const floor = this._saveData.state.floor;
        if (meta.dungeons.floors.length < floor) {
            config = meta.dungeons.floors[meta.dungeons.floors.length - 1];
        } else {
            config = meta.dungeons.floors[floor - 1];
        }
        const loot = this._saveData.state.isFree ? config.freeLoot[cell.loot - 1] : config.loot[cell.loot - 1];

        let lootData: any = {};
        if (loot.mainGameLoot) {
            lootData.items = await Game.lootGenerator.getLootFromTable(loot.mainGameLoot);
        }

        if (loot.equipment) {
            lootData.equip = [];
            for (const id of loot.equipment) {
                if (this._dungeonUser.hasEquip(id)) {
                    lootData.items.push(
                        ...await Game.lootGenerator.getLootFromTable(meta.dungeons.extraEquipmentItem)
                    )
                } else {
                    this._dungeonUser.addEquip(id);
                    lootData.equip.push(id);
                }
            }
        }

        if (loot.key) {
            lootData.key = this._dungeonUser.addKey(loot.key);
        }

        if (loot.potion) {
            lootData.potion = this._dungeonUser.addPotion(loot.potion);
        }

        if (loot.scroll) {
            lootData.scroll = this._dungeonUser.addScroll(loot.scroll);
        }

        if (lootData.items) {
            await this._user.inventory.addItemTemplates(lootData.items);
        }

        this._dungeonUser.modifyEnergy(meta.mode.energyPerLoot);

        this._events.lootAcquired(this._revealedLookUp[this.cellToIndex(cell)]);

        await this.increaseRank(1);

        delete cell.loot;

        return lootData;
    }

    private triggerTrap(cell: Cell) {
        const meta = Game.dungeonManager.getMeta();

        // determine jamming chance
        const mapRevealed = cell.r;
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
            delete cell.trap;
        } else {
            if (mapRevealed) {
                this._saveData.state.defRevealed++;
            } else {
                this._saveData.state.defHidden++;
            }
        }
    }

    private moveToCell(cellId: number) {
        const targetCell = this.getRevealedCell(cellId);

        if (!targetCell) {
            throw errors.IncorrectArguments;
        }

        this._dungeonUser.moveTo(cellId);
    }

    private async defuseTrap(cell: Cell, useEnergy: boolean) {
        if (!cell.trap) {
            return;
        }

        const meta = Game.dungeonManager.getMeta();
        const trapData = meta.traps.traps[cell.trap.id];
        // use item if any
        this._dungeonUser.defuseTrap(trapData, useEnergy);
        this._events.trapRemoved(this._revealedLookUp[this.cellToIndex(cell)]);
        delete cell.trap;
        await this.increaseRank(3);
    }

    private async useAltar(cell: Cell) {
        const meta = Game.dungeonManager.getMeta();
        const altarData = meta.altars.altars[cell.altar.id];

        this._dungeonUser.applyAltar(altarData);
        delete cell.altar;
        this._events.altarApplied(this._revealedLookUp[this.cellToIndex(cell)]);

        if (altarData.type == AltarType.Energy) {
            await this.increaseRank(2);
        } else {
            await this.increaseRank(1);
        }
    }

    private indexRevealedCells() {
        this._revealedLookUp = {};

        let index = 0;
        for (const cellId of this._saveData.state.revealed) {
            this._revealedLookUp[cellId] = index;
            index++;
        }

        this._aStar.cache(this._saveData.data.cells);
    }

    cellToIndex(cell: Cell) {
        return cellToIndex(cell, this._saveData.data.width);
    }

    isRevealed(cellId: number) {
        return this._revealedLookUp[cellId] !== undefined;
    }

    private initPlayer() {
        if (!this._dungeonUser) {
            this._dungeonUser = new DungeonUser(this._saveData.state.user, this._events, Game.dungeonManager.getMeta().progression);
            this._combat = new DungeonCombat(this._dungeonUser, this._events);
        }
    }

    private async increaseRank(points: number) {
        if (this.isFree) {
            return;
        }
        await Game.dungeonManager.updateRank(this._user.id, points);
    }

    private async _save() {
        await Game.dungeonManager.saveProgress(this._user.id, this._saveData);
    }

    private assertAllowedToPlayer() {
        if (this._saveData.state.user.level == 0) {
            throw errors.IncorrectArguments;
        }
    }

    private revealClosestCells() {
        let revealed = false;
        const currentCell = this.getRevealedCell(this._dungeonUser.position);
        for (const cellIdx of currentCell.c) {
            if (!this._revealedLookUp[cellIdx]) {
                revealed = true;
                this.revealCell(this.getCell(cellIdx), true);
            }
        }

        if (revealed) {
            this._dungeonUser.addScroll(-1);
        }
        
        return revealed;
    }

    private assertNotFinished() {
        if (Game.dungeonManager.isFinished()) {
            throw errors.IncorrectArguments;
        }
    }
}