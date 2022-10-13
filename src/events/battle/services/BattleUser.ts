import _ from "lodash";
import { BattleCore } from "./BattleCore";
import { BattleUserState } from "../types";
import {
  CURRENCY_COINS,
  CURRENCY_CRYSTALS,
  CURRENCY_ENERGY,
  SQUAD_REWARDS,
  UNIT_TRIBE_FALLEN_KING,
  UNIT_TRIBE_LEGENDARY,
  UNIT_TRIBE_TITAN,
} from "../../../knightlands-shared/battle";
import game from "../../../game";

const isProd = process.env.ENV == "prod";

const ENERGY_MAX = 36;
const ENERGY_CYCLE_SEC = isProd ? (15 * 60) / 2 : 1;
const ENERGY_AMOUNT_PER_CYCLE = 1;

export class BattleUser {
  protected _state: BattleUserState;
  protected _core: BattleCore;
  protected _energyInterval: any;
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
    this.wakeUp();
  }

  public setInitialState() {
    this._state = {
      balance: {
        [CURRENCY_ENERGY]: ENERGY_MAX,
        [CURRENCY_COINS]: isProd ? 0 : 1000000,
        [CURRENCY_CRYSTALS]: isProd ? 0 : 1000000,
      },
      timers: {
        energy: game.nowSec,
      },
      rewards: {
        dailyRewards: [],
        squadRewards: [
          {
            tribe: UNIT_TRIBE_TITAN,
            activeTemplates: [],
            canClaim: false,
            claimed: false,
          },
          {
            tribe: UNIT_TRIBE_LEGENDARY,
            activeTemplates: [],
            canClaim: false,
            claimed: false,
          },
          {
            tribe: UNIT_TRIBE_FALLEN_KING,
            activeTemplates: [],
            canClaim: false,
            claimed: false,
          },
        ],
      },
    } as BattleUserState;

    this.setActiveReward();
  }

  public dispose() {
    clearInterval(this._energyInterval);
  }

  protected wakeUp() {
    // Debit energy if possible
    if (this.energy < ENERGY_MAX) {
      let accumulatedEnergy = this.getAccumulatedEnergy();
      this.modifyBalance(CURRENCY_ENERGY, accumulatedEnergy);
      this.launchEnergyTimer(true);
    }
  }

  protected getAccumulatedEnergy(): number {
    let cycleLength = ENERGY_CYCLE_SEC;
    let energyPerCycle = ENERGY_AMOUNT_PER_CYCLE;
    let energyPerSecond = energyPerCycle / cycleLength;

    let passedTime = game.nowSec - this._state.timers.energy;
    let accumulatedEnergy = passedTime * energyPerSecond;

    return Math.floor(accumulatedEnergy);
  }

  protected launchEnergyTimer(force: boolean): void {
    if (this._energyInterval) {
      if (force) {
        clearInterval(this._energyInterval);
        this._energyInterval = null;
      } else {
        return;
      }
    }

    this._energyInterval = setTimeout(() => {
      this.modifyBalance(CURRENCY_ENERGY, ENERGY_AMOUNT_PER_CYCLE);
      this._state.timers.energy = game.nowSec;

      if (this.energy < ENERGY_MAX) {
        this.launchEnergyTimer(true);
      } else {
        this._state.balance[CURRENCY_ENERGY] = ENERGY_MAX;
        clearInterval(this._energyInterval);
        this._energyInterval = null;
      }

      this._core.events.flush();
    }, ENERGY_CYCLE_SEC * 1000);
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

    if (
      currency === CURRENCY_ENERGY &&
      this.energy < ENERGY_MAX &&
      amount < 0
    ) {
      this.launchEnergyTimer(false);
    }
  }

  public claimDailyReward(): void {}

  public async claimSquadReward(tribe: string): Promise<any> {
    const rewardData = this._state.rewards.squadRewards.find(
      (e) => e.tribe === tribe
    );
    if (!rewardData.canClaim || rewardData.claimed) {
      return;
    }

    const rewardMeta = _.cloneDeep(SQUAD_REWARDS).find(
      (e) => e.tribe === tribe
    );
    const rewardItems = [
      {
        item: rewardMeta.reward,
        quantity: 1,
      },
    ];
    await this._core.gameUser.inventory.addItemTemplates(rewardItems);

    rewardData.claimed = true;
    rewardData.canClaim = false;

    this._core.events.squadRewards(this._state.rewards.squadRewards);

    return rewardItems;
  }

  public checkSquadReward(): void {
    // Update user state
    _.cloneDeep(SQUAD_REWARDS).forEach((entry) => {
      const rewardData = this._state.rewards.squadRewards.find(
        (e) => e.tribe === entry.tribe
      );
      if (rewardData.claimed) {
        return;
      }

      const currentTemplates = this._core.game.userFighters.map(
        (u) => u.template
      );
      rewardData.activeTemplates = _.intersection(
        currentTemplates,
        entry.templates
      );
      if (rewardData.activeTemplates.length === entry.templates.length) {
        rewardData.canClaim = true;
      }
    });

    this._core.events.squadRewards(this._state.rewards.squadRewards);
  }

  public purchase(id: number): void {
    console.log('Purchase', { id });
  }
}
