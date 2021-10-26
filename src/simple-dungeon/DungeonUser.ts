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
    }

    get position() {
        return this._state.cell;
    }

    get maxHealth() { // Base Heath + (1,4 * значение параметра Слиа)+(1,15 * значение параметра Выносливость);
        return Math.ceil(this._progression.baseHealth + (1.4 * this._state.stats.str) + (1.15 * this._state.stats.sta));
    }

    get health() {
        return this._state.health;
    }

    get defense() { // Base Defense+(1,5 * значение параметра Ловкость)+(1,25 * значение параметра Выносливость). 
        return Math.ceil(this._progression.baseDefense + (1.5 * this._state.stats.dex) + (1.25 * this._state.stats.sta));
    }

    get attack() { // Base Attack+(1,5 * значение параметра Сила)+(1,25 * значение параметра Интеллект);
        return Math.ceil(this._progression.baseAttack + (1.5 * this._state.stats.str) + (1.25 * this._state.stats.int));
    }

    get maxEnergy() { // Base Energy +(1,01 * значение параметра Выносливость)+(1,05 * значение параметра Интеллект);
        return Math.ceil(this._progression.baseEnergy + (1.01 * this._state.stats.sta) + (1.05 + this._state.stats.int));
    }

    get energy() {
        return this._state.energy;
    }

    resetEnergy() {
        this._state.energy = this.maxEnergy;
    }

    resetHealth() {
        this._state.health = this.maxHealth;
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