import game from "../../game";
import errors from "../../knightlands-shared/errors";

import User from "../../user";
import { BattleEvents } from "./BattleEvents";
import { BattleUserState } from "./types";

export class BattleUser {
  private _state: BattleUserState;
  private _events: BattleEvents;
  private _user: User;
  private day = 1;

  constructor(state: BattleUserState | null, events: BattleEvents, user: User) {
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
        energy: 10000,
        coins: 5000,
        crystals: 2000,
      },
      timers: {
        energy: 0
      },
      rewards: {
        // TODO set rewards
        dailyRewards: [],
        rankingRewards: {}
      },
    } as BattleUserState;

    this.setActiveReward();
  }

  private setEventDay() {}

  async setActiveReward() {}

  public getState(): BattleUserState {
    return this._state;
  }

  public async testAction(action) {
    return;
  }

  public claimDailyReward(): void {

  }

  public claimSquadReward(): void {

  }

  public purchase(commodity: string, currency: string, shopIndex: number): void {

  }
}
