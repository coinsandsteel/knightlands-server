import _ from "lodash";
import { BattleCore } from "./BattleCore";
import { BattleUserState } from "../types";
import { COMMODITY_COINS, COMMODITY_CRYSTALS, COMMODITY_ENERGY, SQUAD_REWARDS, UNIT_TRIBE_FALLEN_KING, UNIT_TRIBE_LEGENDARY, UNIT_TRIBE_TITAN } from "../../../knightlands-shared/battle";

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
        dailyRewards: [],
        squadRewards: [
          { tribe: UNIT_TRIBE_TITAN, activeTemplates: [], canClaim: false },
          { tribe: UNIT_TRIBE_LEGENDARY, activeTemplates: [], canClaim: false },
          { tribe: UNIT_TRIBE_FALLEN_KING, activeTemplates: [], canClaim: false },
        ]
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

  public checkSquadReward(): void {
    // Update user state
    _.cloneDeep(SQUAD_REWARDS).forEach(entry => {
      const rewardData = this._state.rewards.squadRewards.find(e => e.tribe === entry.tribe);
      const currentTemplates = this._core.game.userFighters.map(u => u.template);
      rewardData.activeTemplates = _.intersection(currentTemplates, entry.templates);
      if (rewardData.activeTemplates.length === 5) {
        rewardData.canClaim = true;
      }
    });
    this._core.events.squadRewards(this._state.rewards.squadRewards);
  }

  public purchase(commodity: string, currency: string, shopIndex: number): void {

  }
}
