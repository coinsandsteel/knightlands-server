import _ from "lodash";
import User from "../../user";
import { MarchPetData, MarchRewardDayData, MarchUserState } from "./types";
import { MarchEvents } from "./MarchEvents";
import Errors from "../../knightlands-shared/errors";
import Game from "../../game";
import * as march from "../../knightlands-shared/march";
import { Pet } from "./units/Pet";

export class MarchUser {
    private _state: MarchUserState;
    private _events: MarchEvents;
    private _user: User;
    private day = 1;

    get gold(): number {
      return this._state.balance.gold;
    }

    constructor(state: MarchUserState | null, events: MarchEvents, user: User) {
        this._events = events;
        this._user = user;

        if (state) {
          this._state = state;
        } else {
          this.setInitialState();
        }
    }
   
    public async init() {
      this.setEventDay();
      this.setActiveReward();
    }
      
    public setInitialState() {
      this._state = {
        balance: {
          sessionGold: 0,
          gold: 50000
        },
        preGameBoosters: {
          maxHealth: 0,
          extraLife: 0,
          key: 0
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
      this.setActiveReward();
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

    async collectDailyMarchReward() {
      const entry = this._state.dailyRewards[this.day - 1];

      if (entry.collected) {
        throw Errors.DailyMarchRewardCollected;
      }

      await this._user.inventory.addItemTemplates([{
        item: march.TICKET_ITEM_ID,
        quantity: entry.quantity
      }]);

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

      const classIndex = petClass - 1;
      const price = march.PETS_PRICE[classIndex][0];
      if (this.gold < price) {
        throw Errors.NotEnoughCurrency;
      }

      this.modifyBalance(march.CURRENCY_GOLD, -price);
      this._state.pets.push({ petClass, level: 1, goldCollected: 0} as MarchPetData);
      this._events.pets(this._state.pets);
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

      const classIndex = petClass - 1;
      const price = march.PETS_PRICE[classIndex][pet.level];
      if (this.gold < price) {
        throw Errors.NotEnoughCurrency;
      }
      
      this.modifyBalance(march.CURRENCY_GOLD, -price);

      const levelIndex = this._state.pets[index].level - 1;
      /*await this._user.inventory.addItemTemplates([{
        item: march.EVENT_REWARD_ITEM_ID[levelIndex][classIndex],
        quantity: 1
      }]);*/
      
      this._state.pets[index].level += 1;
      this._events.pets(this._state.pets);
    }
    
    public getState(): MarchUserState {
      return this._state;
    }

    public modifyBalance(currency: string, amount: number) {
      this._state.balance[currency] += amount;
      this._events.balance(currency, this._state.balance[currency]);
    }

    public addSessionGold(amount: number): void {
      this.modifyBalance(march.CURRENCY_SESSION_GOLD, amount);
    }
  
    public resetSessionGoldBalance() {
      this._state.balance[march.CURRENCY_SESSION_GOLD] = 0;
      this._events.balance(march.CURRENCY_SESSION_GOLD, 0);
    }

    public purchasePreGameBooster(type: string) {
      // TODO retreive price
      const price = 100;
      if (price > this.gold) {
        throw Errors.NotEnoughCurrency;
      }

      this.modifyBalance(march.CURRENCY_GOLD, -price);
      this.modifyPreGameBooster(type, 1);
    }

    public modifyPreGameBooster(type: string, value: number) {
      this._state.preGameBoosters[type] += value;
      if (this._state.preGameBoosters[type] < 0) {
        this._state.preGameBoosters[type] = 0;
      }
      this._events.preGameBoosters(this._state.preGameBoosters);
    }

    public updateGoldStat(amount: number, petClass: number) {
      const index = this._state.pets.findIndex((pet) => pet.petClass === petClass);
      if (index === -1) {
        throw Errors.MarchPetNotUnlocked;
      }
      this._state.pets[index].goldCollected += amount;
    }

    public getGoldStat(petClass: number) {
      const index = this._state.pets.findIndex((pet) => pet.petClass === petClass);
      if (index === -1) {
        throw Errors.MarchPetNotUnlocked;
      }
      return this._state.pets[index].goldCollected;
    }

    async purchaseGold(shopIndex, currency) {
      // Retrieve meta
      // let meta = [{ quantity: 100, hard: 10, flesh: 5 }]
      //let shopMeta = Game.marchManager.shopMeta;
      let shopMeta = Game.marchManager.shopMeta;
      let choosedShopOption = shopMeta[shopIndex];

      // Wrong metadata protection
      if (!choosedShopOption || !choosedShopOption.hard || !choosedShopOption.flesh) {
        throw Errors.IncorrectArguments;
      }

      // check balance
      let balance = 0;
      let price = Infinity;
      switch (currency) {
        case "hard": {
          balance = this._user.hardCurrency;
          price = choosedShopOption.hard;
          break;
        }
        case "flesh": {
          balance = this._user.dkt;
          price = choosedShopOption.flesh;
          break;
        }
        default: {
          return;
        }
      }
      if (balance < price) {
        throw Errors.IncorrectArguments;
      }

      // change balance
      if (currency === "hard") {
        this._user.addHardCurrency(-price);
      } else if (currency === "flesh") {
        this._user.addDkt(-price);
      }

      const addItems = [{
        item: march.TICKET_ITEM_ID,
        quantity: choosedShopOption.quantity
      }]

      await this._user.inventory.addItemTemplates(addItems);

      return addItems;
    }
    
    public flushStats(pet: Pet): void {
      let goldModifier = pet.checkClassAndLevel(4, 2) ? 1.2 : 1;
      let goldAmount = this._state.balance.sessionGold * goldModifier;
  
      this.modifyBalance(march.CURRENCY_GOLD, goldAmount);
      this.updateGoldStat(goldAmount, pet.petClass);
      this.voidBoosters();
      
      Game.marchManager.updateRank(
        this._user.id, 
        pet.petClass, 
        this.getGoldStat(pet.petClass)
      );
    }

    public voidBoosters(): void {
      this.modifyPreGameBooster(march.BOOSTER_HP, -1);
      this.modifyPreGameBooster(march.BOOSTER_KEY, -1);
      this.modifyPreGameBooster(march.BOOSTER_LIFE, -1);
    }

    public canUsePreGameBooster(type: string): boolean {
      return this._state.preGameBoosters[type] > 0;
    }

    public async testAction(action) {
      switch (action) {
        case 'addTicket':{
          await this._user.inventory.addItemTemplates([
            { 
              item: march.TICKET_ITEM_ID,
              quantity: 1
            }
          ]);
          break;
        }
        case 'resetDailyRewards':{
          this.day = 1;
          this._state.dailyRewards = this.getInitialDailyrewards();
          this.setActiveReward();
          break;
        }
        case 'plus1Day':{
          this.day++;
          this.setActiveReward();
          break;
        }
      }
    }

    public debitTicket() {
      if (!this._user.inventory.hasItems(march.TICKET_ITEM_ID, 1)) {
        throw Errors.MarchNoTicket;
      }
      
      // Debit one ticket
      this._user.inventory.removeItemByTemplate(
        march.TICKET_ITEM_ID
      );
    }
}