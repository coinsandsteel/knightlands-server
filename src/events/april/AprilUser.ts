import errors from "../../knightlands-shared/errors";
import User from "../../user";
import { AprilEvents } from "./AprilEvents";
import { AprilRewardDayData, AprilRewardHeroesData, AprilUserState } from "./types";
import * as april from "../../knightlands-shared/april";
import game from "../../game";

const PERIODIC_REWARD_PERIOD = 60 * 60; // 1 hour

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
          left: 3
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
    for (let day = 1; day <= 15; day++) {
      entries.push({
        collected: false,
        active: false,
        quantity: 3,
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

    this._events.dailyRewards(this._state.rewards.dailyRewards);
    this._events.flush();
  }

  async claimHourReward() {
    if (
      // We should allow claim if it's empty 
      this._state.hourRewardClaimed
      &&
      // "Reward + 1" hr should be relatively lower (in the past) of "now" to allow claim.
      this._state.hourRewardClaimed + PERIODIC_REWARD_PERIOD >= game.nowSec
    ) {
      throw errors.IncorrectArguments;
    }

    await this._user.inventory.addItemTemplates([{
      item: game.aprilManager.aprilTicketId,
      quantity: 1
    }]);

    this._state.hourRewardClaimed = game.nowSec;
    this._events.hourRewardClaimed(this._state.hourRewardClaimed);
  }

  public modifyBalance(currency: string, amount: number) {
    this._state.balance[currency] += amount;
    this._events.balance(currency, this._state.balance[currency]);
  }

  public updateHeroScore(heroClass: string, amount: number) {
    this._state.rewards.heroRewards[heroClass].score += amount;
  }

  async claimHeroReward(heroClass: string) {
    const targetHero = april.HEROES.find((entry) => entry.heroClass === heroClass);
    if (!targetHero) {
      throw errors.IncorrectArguments;
    }
    if (this._state.rewards.heroRewards[heroClass].score < targetHero.rewardGoal) {
      throw errors.NotEnoughResource;
    }
    await this._user.inventory.addItemTemplates(targetHero.rewardItems);

    this._state.rewards.heroRewards[heroClass].claimed = true;
    this._events.heroRewards(this._state.rewards.heroRewards);
  }

  public addSessionGold(amount: number): void {
    this.modifyBalance(april.CURRENCY_SESSION_GOLD, amount);
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

  public flushStats(): void {
    this.modifyBalance(april.CURRENCY_GOLD, this._state.balance.sessionGold);

    game.aprilManager.updateRank(
      this._user.id, 
      this._state.balance.sessionGold
    );
  }

  public getHeroStat(): AprilRewardHeroesData {
    return this._state.rewards.heroRewards;
  }
}
