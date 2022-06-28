import { COMMODITY_COINS, COMMODITY_CRYSTALS, COMMODITY_ENERGY } from "../../knightlands-shared/battle";
import { BattleController } from "./BattleController";
import { BattleUserState } from "./types";

export class BattleUser {
  protected _state: BattleUserState;
  protected _ctrl: BattleController;
  protected day = 1;

  constructor(state: BattleUserState | null, ctrl: BattleController) {
    this._ctrl = ctrl;

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
  
  public async init() {
    this.setEventDay();
    this.setActiveReward();
  }
    
  public setInitialState() {
    this._state = {
      balance: {
        [COMMODITY_ENERGY]: 10000,
        [COMMODITY_COINS]: 5000,
        [COMMODITY_CRYSTALS]: 2000,
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

  async setActiveReward() {}

  public getState(): BattleUserState {
    return this._state;
  }

  public debitCurrency(currency: string, amount: number): void {
    this._state.balance[currency] -= amount;
    if (this._state.balance[currency] < 0) {
      this._state.balance[currency] = 0;
    }
    this._ctrl.events.balance(this._state.balance);
  }

  public claimDailyReward(): void {

  }

  public claimSquadReward(): void {

  }

  public purchase(commodity: string, currency: string, shopIndex: number): void {

  }
}
