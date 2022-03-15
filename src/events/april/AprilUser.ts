import errors from "../../knightlands-shared/errors";
import User from "../../user";
import { AprilEvents } from "./AprilEvents";
import { AprilRewardDayData, AprilThirdAction, AprilUserState } from "./types";
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

  get thirdAction(): AprilThirdAction {
    return this._state.thirdAction;
  }
  
  public async init() {
    this.setEventDay();
    this.setActiveReward();
    // events.flush shouldn't be here, because flush is an async way to pass data.
    // hourRewardClaimed will be passed the frontend right after load().
  }
    
  public setInitialState() {
    this._state = {
      balance: {
        sessionGold: 0,
        gold: 0
      },
      dailyRewards: this.getInitialDailyrewards(),
      hourRewardClaimed: null,
      thirdAction: {
        isActive: false,
        times: 0
      }
    } as AprilUserState;

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

  getInitialDailyrewards(): AprilRewardDayData[] {
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

  public getState(): AprilUserState {
    return this._state;
  }

  async collectDailyReward() {
    const entry = this._state.dailyRewards[this.day - 1];

    if (entry.collected) {
      throw errors.DailyAprilRewardCollected;
    }

    await this._user.inventory.addItemTemplates([{
      item: game.aprilManager.aprilTicketId,
      quantity: entry.quantity
    }]);

    this._state.dailyRewards[this.day - 1].collected = true;
    this._state.dailyRewards[this.day - 1].date = new Date().toISOString().split("T")[0];

    this._events.dailyRewards(this._state.dailyRewards);
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

    // Use seconds instead if msec
    this._state.hourRewardClaimed = game.nowSec;
    this._events.hourRewardClaimed(this._state.hourRewardClaimed);
    // Call events.flush only in the controller!
  }

  public modifyBalance(currency: string, amount: number) {
    this._state.balance[currency] += amount;
    this._events.balance(currency, this._state.balance[currency]);
  }

  public addSessionGold(amount: number): void {
    this.modifyBalance(april.CURRENCY_SESSION_GOLD, amount);
  }

  public purchaseCharacter(characterIndex: number) {
    const character = this._state.characters.find((index) => index === characterIndex);
    if (character) {
      throw errors.AprilCharacterUnlocked;
    }

    const price = april.HERO_CLASSES_PRICES[characterIndex];
    if (this.gold < price) {
      throw errors.NotEnoughCurrency;
    }

    this.modifyBalance(april.CURRENCY_GOLD, -price);
    this._state.characters.push(characterIndex);
    this._events.characters(this._state.characters);
  }

  public purchaseThirdAction() {
    if (this.thirdAction.isActive) {
      throw errors.IncorrectArguments;
    }

    // TODO: Use correct formula to calculate price
    const price = (this.thirdAction.times + 1) * 100;
    if (this.gold < price) {
      throw errors.NotEnoughCurrency;
    }

    this.modifyBalance(april.CURRENCY_GOLD, -price);
    this.thirdAction.isActive = true;
    this.thirdAction.times += 1;
    this._events.thirdAction(this.thirdAction);
  }

  public flushStats(): void {
    this.modifyBalance(april.CURRENCY_GOLD, this._state.balance.sessionGold);

    game.aprilManager.updateRank(
      this._user.id, 
      this._state.balance.sessionGold
    );
  }
}
