import game from "../../game";
import errors from "../../knightlands-shared/errors";
import User from "../../user";
import { AprilEvents } from "./AprilEvents";
import { AprilRewardDayData, AprilUserState } from "./types";

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
      dailyRewards: this.getInitialDailyrewards(),
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

  async collectDailyAprilReward() {
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
}