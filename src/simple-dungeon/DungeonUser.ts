import game from "../game";
import { AltarType } from "../knightlands-shared/dungeon_types";
import { DungeonEvents } from "./DungeonEvents";
import { AltarData, DungeonUserState, ProgressionData, TrapData } from "./types";

export class DungeonUser {
    private _state: DungeonUserState;
    private _events: DungeonEvents;
    private _progression: ProgressionData;

    constructor(state: DungeonUserState, events: DungeonEvents, progression: ProgressionData) {
        this._state = state;
        this._events = events;
        this._progression = progression;

        if (!this._state.equip) {
            this._state.equip = [];
        }

        if (!this._state.stats) {
            this._state.stats = {
                str: 0,
                dex: 0,
                int: 0,
                sta: 0
            }
        }

        if (!this._state.exp) {
            this._state.exp = 0;
        }
    }

    get position() {
        return this._state.cell;
    }

    get health() {
        return this._state.health;
    }

    get maxHealth() { // Base Heath + (1,4 * значение параметра Слиа)+(1,15 * значение параметра Выносливость);
        return Math.ceil(this._progression.baseHealth + (1.4 * this._state.stats.str) + (1.15 * this._state.stats.sta));
    }

    get defense() { // Base Defense+(1,5 * значение параметра Ловкость)+(1,25 * значение параметра Выносливость). 
        return Math.ceil(this._progression.baseDefense + (1.5 * this._state.stats.dex) + (1.25 * this._state.stats.sta));
    }

    get attack() { // Base Attack+(1,5 * значение параметра Сила)+(1,25 * значение параметра Интеллект);
        return Math.ceil(this._progression.baseAttack + (1.5 * this._state.stats.str) + (1.25 * this._state.stats.int));
    }

    get maxEnergy() { // Base Energy +(1,01 * значение параметра Выносливость)+(1,05 * значение параметра Интеллект);
        // return Math.ceil(this._progression.baseEnergy + (1.01 * this._state.stats.sta) + (1.05 + this._state.stats.int));
        return 1000;
    }

    get energyRegen() { // (86400/(10+(1,01 * значение параметра Выносливость)+(1,01 * значение параметра Интеллект))/ Текущий максимум энергии (Energy));
        return (86400 / (10 + (1.01 * this._state.stats.sta) + (1.01 * this._state.stats.int)) / this.maxEnergy)
    }

    get healthRegen() { // ((86400/(20+(1,01 * зачение параметра Ловкость)+(1,01 * значение параметра Выносливость)+(1,01 * значение параметра Сила))/ Текущий максимум здоровья(Heath));
        return (86400 / (20 + (1.01 * this._state.stats.dex) + (1.01 * this._state.stats.sta) + (1.01 * this._state.stats.str)) / this.maxHealth)
    }

    get energy() {
        return this._state.energy;
    }

    get isInvisible() {
        return !!this._state.invis;
    }

    updateHealthAndEnergy() {
        const lastRegen = this._state.lastHpRegen;
        const timeElapsed = game.nowSec - lastRegen;

        const hpRegened = Math.floor(timeElapsed * this.healthRegen);
    }

    hasEquip(id: number) {
        return this._state.equip.find(x => x == id) !== undefined;
    }

    updateInvisibility() {
        if (this._state.invis > 0) {
            this._state.invis--;
        }
    }

    resetEnergy() {
        this._state.energy = this.maxEnergy;
        this.updateHealthAndEnergy();
        this._events.energyChanged(this._state.energy);
    }

    resetHealth() {
        this._state.health = this.maxHealth;
        this.updateHealthAndEnergy();
        this._events.playerHealth(this.health);
    }

    addInvisibility(steps: number) {
        this._state.invis = (this._state.invis || 0) + steps;
    }

    addEquip(id: number) {
        this._state.equip.push(id);
        return this._state.equip;
    }

    addKey(count: number) {
        this._state.key = (this._state.key || 0) + count;
        return this._state.key;
    }

    addPotion(count: number) {
        this._state.potion = (this._state.potion || 0) + count;
        return this._state.potion;
    }

    addScroll(count: number) {
        this._state.scroll = (this._state.scroll || 0) + count;
        return this._state.scroll;
    }

    addExp(exp: number) {
        this._state.exp = (this._state.exp || 0) + exp;
        let nextLevelExp = this._progression.experience[this._state.level - 1];
        while (nextLevelExp <= this._state.exp) {
            this._state.exp -= nextLevelExp;
            this._state.level++;
            this._events.playerLevel(this._state.level);
            nextLevelExp = this._progression.experience[this._state.level - 1];
        }

        this._events.playerExp(this._state.exp);
    }

    modifyEnergy(value: number) {
        this._state.energy += value;
        if (this._state.energy < 0) {
            this._state.energy = 0;
        }
        this._events.energyChanged(this._state.energy);
    }

    modifyHealth(value: number) {
        this._state.health += value;

        if (this._state.health < 0) {
            this._state.health = 0;
        } else if (this._state.health > this.maxHealth) {
            this._state.health = this.maxHealth;
        }

        this._events.playerHealth(this.health);
    }

    defuseTrap(trapData: TrapData) {
        if (this._state.key > 0) {
            this._state.key--;
        } else {
            this.modifyEnergy(-trapData.damage);
        }
    }

    moveTo(cellId: number) {
        this._state.cell = cellId;
        this._events.playerMoved(cellId);
    }

    applyAltar(altar: AltarData) {
        if (altar.type == AltarType.Health) {
            this.modifyHealth(altar.restoreValue);
        } else if (altar.type == AltarType.Energy) {
            this.modifyEnergy(altar.restoreValue);
        }
    }

    applyDamage(damage: number) {
        this.modifyHealth(-damage);
    }
}