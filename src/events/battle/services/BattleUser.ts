import { COMMODITY_COINS, COMMODITY_CRYSTALS, COMMODITY_ENERGY } from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import { BattleUserState } from "../types";

export class BattleUser {
  protected _state: BattleUserState;
  protected _core: BattleCore;
  protected day = 1;

  constructor(state: BattleUserState | null, core: BattleCore) {
    this._core = core;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }

  get energy(): number {
    return this._state.balance.energy;
  }

  get coins(): number {
    return this._state.balance.coins;
  }

  get crystals(): number {
    return this._state.balance.crystals;
  }

  public async load() {
    //('User load');
    this.setEventDay();
    this.setActiveReward();
  }

  public setInitialState() {
    this._state = {
      balance: {
        [COMMODITY_ENERGY]: 1000000,
        [COMMODITY_COINS]: 1000000,
        [COMMODITY_CRYSTALS]: 1000000,
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

  protected setEventDay() {}

  public setActiveReward() {}

  public getState(): BattleUserState {
    return this._state;
  }

  public modifyBalance(currency: string, amount: number): void {
    //console.log('modifyBalance', { currency, amount });
    this._state.balance[currency] += amount;
    if (this._state.balance[currency] < 0) {
      this._state.balance[currency] = 0;
    }
    this._core.events.balance(this._state.balance);
  }

  public claimDailyReward(): void {

  }

  public claimSquadReward(): void {

  }

  public purchase(commodity: string, currency: string, shopIndex: number): void {

  }
}
