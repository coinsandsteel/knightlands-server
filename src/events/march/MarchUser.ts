import _ from "lodash";
import User from "../../user";
import { MarchPetData, MarchRewardDayData, MarchUserState } from "./types";
import { MarchEvents } from "./MarchEvents";
import Errors from "../../knightlands-shared/errors";
import Game from "../../game";

export class MarchUser {
    private _state: MarchUserState;
    private _events: MarchEvents;
    private _user: User;
    private day = 1;

    constructor(state: MarchUserState | null, events: MarchEvents, user: User) {
        this._events = events;
        this._user = user;

        if (state) {
          this._state = state;
        } else {
          this.setInitialState();
        }
    }
      
    public setInitialState() {
      this._state = {
        balance: {
          tickets: 0,
          gold: 0
        },
        preGameBoosters: {
          maxHealth: 0,
          extraLife: 0,
          key: 0,
        },
        dailyRewards: this.getInitialDailyrewards(),
        pets: [
          {
            petClass: 1,
            level: 1,
            goldCollected: 0
          }
        ]
      } as MarchUserState;
    }

    private setEventDay() {
      const currentDate = new Date().toISOString().split("T")[0];
      const currentDayIndex = this._state.dailyRewards.findIndex(
        entry => entry.date && entry.date === currentDate
      );

      if (currentDayIndex !== -1) {
        this.day = currentDayIndex + 1;
        return;
      }

      const firstUncollectedDayIndex = this._state.dailyRewards.findIndex(
        entry => !entry.date && !entry.collected
      );
      this.day = firstUncollectedDayIndex + 1;
    }

    getInitialDailyrewards(): MarchRewardDayData[] {
      const entries = [];
      for (let day = 1; day <= 15; day++) {
        entries.push({
          collected: false,
          active: false,
          quantity: day,
        });
      }
      this.setActiveReward();
      return entries;
    }

    async setActiveReward() {
      this._state.dailyRewards = this._state.dailyRewards.map((entry, index) => {
        const isCurrentDay = index+1 === this.day;
        const newEntry = {
          ...entry,
          active: isCurrentDay,
        };
        return newEntry;
      });
      this._events.dailyRewards(this._state.dailyRewards);
      this._events.flush();
    }

    async collectDailyLunarReward() {
      const entry = this._state.dailyRewards[this.day - 1];

      if (entry.collected) {
        throw Errors.DailyMarchRewardCollected;
      }

      const ticketItem = Game.marchManager.getEventTicketItems(entry.quantity);

      await this._user.inventory.addItemTemplates(ticketItem);
      this._state.dailyRewards[this.day - 1].collected = true;
      this._state.dailyRewards[this.day - 1].date = new Date().toISOString().split("T")[0];

      this._events.dailyRewards(this._state.dailyRewards);
      this._events.flush();
    }

    async unlockPet(petClass: number) {
      const pet = this._state.pets.find((pet) => pet.petClass === petClass);
      if (pet) {
        throw Errors.MarchPetUnlocked;
      }

      this._state.pets.push({ petClass, level: 1, goldCollected: 0});

      this._events.pets(this._state.pets);
      this._events.flush();
    }

    async upgradePet(petClass: number) {
      const index = this._state.pets.findIndex((pet) => pet.petClass === petClass);
      if (index === -1) {
        throw Errors.MarchPetNotUnlocked;
      }
      const pet = this._state.pets[index];
      if (pet.level === 3) {
        throw Errors.MarchPetMaxLevel;
      }

      this._state.pets[index].level += 1;

      this._events.pets(this._state.pets);
      this._events.flush();
    }
    
    public getState(): MarchUserState {
      return this._state;
    }
    
    public async init() {
      this.setEventDay();
      this.setActiveReward();
    }

    public modifyBalance(currency: string, amount: number) {
      this._state.balance[currency] += amount;
      this._events.balance(currency, this._state.balance[currency]);
    }

    public modifyPreGameBooster(type: string, amount: number) {
      this._state.preGameBoosters[type] = Math.min(Math.max(amount + this._state.preGameBoosters[type], 0), 1);
      this._events.preGameBoosters(this._state.preGameBoosters);
    }
}