import game from "../game";
import errors from "../knightlands-shared/errors";
import { XmasEvents } from "./XmasEvents";
import { XmasState } from "./types";

export class XmasUser {
    private _state: XmasState;
    private _events: XmasEvents;

    constructor(state: XmasState, events: XmasEvents) {
        this._state = state;
        this._events = events;
    }

    /*updateHealthAndEnergy(resetTimers: boolean = false) {
        const regenEvent: any = {};

        {
            const lastRegen = this._state.lastHpRegen;
            const timeElapsed = game.nowSec - lastRegen;

            const hpRegened = Math.floor(timeElapsed / this.healthRegen);
            if (hpRegened > 0) {
                this._state.lastHpRegen += Math.floor(hpRegened * this.healthRegen);

                if (!resetTimers) {
                    this.modifyHealth(hpRegened);
                }

                regenEvent.hp = this._state.lastHpRegen;
            }
        }

        {
            const lastRegen = this._state.lastEnergyRegen;
            const timeElapsed = game.nowSec - lastRegen;

            const energyRegened = Math.floor(timeElapsed / this.energyRegen);
            if (energyRegened > 0) {
                this._state.lastEnergyRegen += Math.floor(energyRegened * this.energyRegen);

                if (!resetTimers) {
                    this.modifyEnergy(energyRegened, true);
                }

                regenEvent.energy = this._state.lastEnergyRegen;
            }
        }

        if (Object.keys(regenEvent).length != 0) {
            this._events.regenUpdate(regenEvent);
        }
    }*/

    /*addExp(exp: number) {
        this._state.exp = (this._state.exp || 0) + exp;
        let nextLevelExp = this._progression.experience[this._state.level - 1];
        while (nextLevelExp <= this._state.exp) {
            this._state.exp -= nextLevelExp;
            this._state.level++;
            this._events.playerLevel(this._state.level);
            nextLevelExp = this._progression.experience[this._state.level - 1];
        }

        this._events.playerExp(this._state.exp);
    }*/

    /*changeStats(stats: object) {
        this._state.stats = { ...this._state.stats, ...stats };
        this._events.statsChanged(this._state.stats);
    }

    canUpdateStats(statsSum) {
      return statsSum <= this._state.level - 1;
    }*/
}