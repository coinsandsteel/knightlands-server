import errors from "../../knightlands-shared/errors";
import User from "../../user";
import { AprilEvents } from "./AprilEvents";
import { AprilRewardDayData, AprilRewardHeroesData, AprilUserState } from "./types";
import * as april from "../../knightlands-shared/april";
import game from "../../game";

const PERIODIC_REWARD_PERIODS = [10 * 60, 60 * 60, 60 * 60 * 3]; // 10 mins, 1 hour, 3 hour

export class AprilUser {
  private _state: AprilUserState;
  private _events: AprilEvents;
  private _user: User;
  private day = 1;

  constructor(state: AprilUserState | null, events: AprilEvents, user: User) {
    this._events = events;
    this._user = user;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }
  
  get gold(): number {
    return this._state.balance.gold;
  }

  get heroes(): string[] {
    return this._state.heroes;
  }

  get sessionGold(): number {
    return this._state.balance.sessionGold;
  }

  public async init() {
    this.setEventDay();
    this.setActiveReward();
  }
    
  public setInitialState() {
    this._state = {
      balance: {
        sessionGold: 0,
        gold: 0
      },
      rewards: {
        dailyRewards: this.getInitialDailyrewards(),
        heroRewards: {
          [april.HERO_CLASS_KNIGHT]: { score: 0, claimed: false },
          [april.HERO_CLASS_PALADIN]: { score: 0, claimed: false },
          [april.HERO_CLASS_ROGUE]: { score: 0, claimed: false }
        },
        hourReward: {
          // First hour starts after daily reward was received
          // nextClaim resets after user claim hour reward
          nextRewardAvailable: null, // timestamp, sec
          left: 0
        }
      },
      heroes: []
    } as AprilUserState;

    this.setActiveReward();
  }

  private setEventDay() {
    const currentDate = new Date().toISOString().split("T")[0];
    const currentDayIndex = this._state.rewards.dailyRewards.findIndex(
      entry => entry.date && entry.date === currentDate
    );

    if (currentDayIndex !== -1) {
      this.day = currentDayIndex + 1;
      return;
    }

    const firstUncollectedDayIndex = this._state.rewards.dailyRewards.findIndex(
      entry => !entry.date && !entry.collected
    );
    this.day = firstUncollectedDayIndex + 1;
  }

  getInitialDailyrewards(): AprilRewardDayData[] {
    const entries = [];
    for (let day = 1; day <= 10; day++) {
      entries.push({
        collected: false,
        active: false,
        quantity: Math.ceil(day/2),
      });
    }
    return entries;
  }
  
  async setActiveReward() {
    this._state.rewards.dailyRewards = this._state.rewards.dailyRewards.map((entry, index) => {
      const isCurrentDay = index+1 === this.day;
      const newEntry = {
        ...entry,
        active: isCurrentDay,
      };
      return newEntry;
    });
    this._events.dailyRewards(this._state.rewards.dailyRewards);
    this._events.flush();
  }

  public getState(): AprilUserState {
    return this._state;
  }

  async claimDailyReward() {
    const entry = this._state.rewards.dailyRewards[this.day - 1];

    if (entry.collected) {
      throw errors.DailyAprilRewardCollected;
    }

    await this._user.inventory.addItemTemplates([{
      item: game.aprilManager.aprilTicketId,
      quantity: entry.quantity
    }]);

    this._state.rewards.dailyRewards[this.day - 1].collected = true;
    this._state.rewards.dailyRewards[this.day - 1].date = new Date().toISOString().split("T")[0];

    this._state.rewards.hourReward.left = 3;
    this._state.rewards.hourReward.nextRewardAvailable = game.nowSec + PERIODIC_REWARD_PERIODS[0];

    this._events.dailyRewards(this._state.rewards.dailyRewards);
    this._events.hourReward(this._state.rewards.hourReward);
  }

  async claimHourReward() {
    if (
      this._state.rewards.hourReward.left <= 0
      ||
      !this._state.rewards.dailyRewards[this.day - 1].collected
      ||
      this._state.rewards.hourReward.nextRewardAvailable >= game.nowSec
    ) {
      throw errors.IncorrectArguments;
    }

    await this._user.inventory.addItemTemplates([{
      item: game.aprilManager.aprilTicketId,
      quantity: 1
    }]);

    this._state.rewards.hourReward.left--;
    this._state.rewards.hourReward.nextRewardAvailable = game.nowSec + PERIODIC_REWARD_PERIODS[3 - this._state.rewards.hourReward.left];
    this._events.hourReward(this._state.rewards.hourReward);
  }

  async purchaseGold(shopIndex: number, currency: string) {
    if (shopIndex >= april.SHOP.length) {
      throw errors.IncorrectArguments;
    }
    let choosedShopOption = april.SHOP[shopIndex];

    // check balance
    let balance = 0;
    let price = Infinity;
    let goldAmount = choosedShopOption.quantity;
    switch (currency) {
      case "hard": {
        balance = this._user.hardCurrency;
        price = choosedShopOption.hardPrice;
        break;
      }
      case "dkt": {
        balance = this._user.dkt;
        price = choosedShopOption.fleshPrice;
        break;
      }
      default: {
        return;
      }
    }
    if (balance < price) {
      throw errors.NotEnoughCurrency;
    }

    // change balance
    if (currency === "hard") {
      this._user.addHardCurrency(-price);
    } else if (currency === "dkt") {
      this._user.addDkt(-price);
    }

    this.modifyBalance(april.CURRENCY_GOLD, goldAmount);

    return goldAmount;
  }

  public modifyBalance(currency: string, amount: number) {
    this._state.balance[currency] += amount;
    this._events.balance(currency, this._state.balance[currency]);
  }

  public updateHeroScore(heroClass: string, amount: number) {
    this._state.rewards.heroRewards[heroClass].score += amount;
    this._events.heroRewards(this._state.rewards.heroRewards);
  }

  async claimHeroReward(heroClass: string) {
    const targetHero = april.HEROES.find((entry) => entry.heroClass === heroClass);
    if (!targetHero) {
      throw errors.IncorrectArguments;
    }
    if (this._state.rewards.heroRewards[heroClass].score < targetHero.rewardGoal) {
      throw errors.NotEnoughResource;
    }
    if (this._state.rewards.heroRewards[heroClass].claimed) {
      throw errors.AlreadyClaimed;
    }

    const heroRewards = game.aprilManager.heroRewards[0][heroClass];
    await this._user.inventory.addItemTemplates(heroRewards);

    this._state.rewards.heroRewards[heroClass].claimed = true;
    this._events.heroRewards(this._state.rewards.heroRewards);

    return heroRewards;
  }

  public addSessionGold(amount: number): void {
    this.modifyBalance(april.CURRENCY_SESSION_GOLD, amount);
  }

  public resetSessionGold(): void {
    this._state.balance[april.CURRENCY_SESSION_GOLD] = 0;
    this._events.balance(april.CURRENCY_SESSION_GOLD, 0);
  }

  public purchaseHero(heroClass: string) {
    const hero = this._state.heroes.find((entry) => entry === heroClass);
    if (hero) {
      throw errors.AprilHeroUnlocked;
    }
    
    const targetHero = april.HEROES.find((entry) => entry.heroClass === heroClass);
    if (!targetHero) {
      throw errors.IncorrectArguments;
    }

    const canPurchase = heroClass !== april.HERO_CLASS_ROGUE || this._state.heroes.some(hero => hero === april.HERO_CLASS_PALADIN);
    if (!canPurchase) {
      throw errors.IncorrectArguments;
    }

    if (this.gold < targetHero.price) {
      throw errors.NotEnoughCurrency;
    }

    this.modifyBalance(april.CURRENCY_GOLD, -targetHero.price);

    this._state.heroes.push(heroClass);
    this._events.heroes(this._state.heroes);
  }

  public async purchaseTicket() {
    if (this.gold < april.TICKET_SHOP[0].price) {
      throw errors.NotEnoughCurrency;
    }

    this.modifyBalance(april.CURRENCY_GOLD, -april.TICKET_SHOP[0].price);

    await this._user.inventory.addItemTemplates([
      { 
        item: game.aprilManager.aprilTicketId,
        quantity: april.TICKET_SHOP[0].quantity
      }
    ]);
  }

  public getHeroStat(): AprilRewardHeroesData {
    return this._state.rewards.heroRewards;
  }

  public debitTicket() {
    if (!this._user.inventory.hasItems(game.aprilManager.aprilTicketId, 1)) {
      throw errors.AprilNoTicket;
    }
    
    // Debit one ticket
    this._user.inventory.removeItemByTemplate(
      game.aprilManager.aprilTicketId
    );
  }

  public async testAction(action) {
    switch (action) {
      case 'addRating':{
        game.aprilManager.updateRank(
          this._user.id,
          april.HERO_CLASS_KNIGHT,
          5000
        );
        game.aprilManager.updateRank(
          this._user.id,
          april.HERO_CLASS_PALADIN,
          5000
        );
        game.aprilManager.updateRank(
          this._user.id,
          april.HERO_CLASS_ROGUE,
          5000
        );
        break;
      }
      case 'addTicket':{
        await this._user.inventory.addItemTemplates([
          { 
            item: game.aprilManager.aprilTicketId,
            quantity: 1
          }
        ]);
        break;
      }
      case 'resetDailyRewards':{
        this.day = 1;
        this._state.rewards.dailyRewards = this.getInitialDailyrewards();
        this.setActiveReward();
        break;
      }
      case 'plus1Day':{
        this.day++;
        this.setActiveReward();
        break;
      }
      case 'addGold':{
        this.modifyBalance(april.CURRENCY_GOLD, 100);
        this.updateHeroScore(april.HERO_CLASS_KNIGHT, 100);
        this.updateHeroScore(april.HERO_CLASS_PALADIN, 100);
        this.updateHeroScore(april.HERO_CLASS_ROGUE, 100);
        break;
      }
      case 'resetCharacters':{
        this._state.heroes = [];
        this._state.rewards.heroRewards = {
          [april.HERO_CLASS_KNIGHT]: { score: 0, claimed: false },
          [april.HERO_CLASS_PALADIN]: { score: 0, claimed: false },
          [april.HERO_CLASS_ROGUE]: { score: 0, claimed: false }
        };
        break;
      }
    }
  }
}
