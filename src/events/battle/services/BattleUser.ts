import _ from "lodash";
import { BattleCore } from "./BattleCore";
import { BattleItem, BattleUserState } from "../types";
import {
  COMMODITY_STARTER_PACK,
  CURRENCY_COINS,
  CURRENCY_CRYSTALS,
  CURRENCY_ENERGY,
  SHOP,
  SQUAD_REWARDS,
  UNIT_TRIBE_FALLEN_KING,
  UNIT_TRIBE_LEGENDARY,
  UNIT_TRIBE_TITAN,
} from "../../../knightlands-shared/battle";
import game from "../../../game";
import errors from "../../../knightlands-shared/errors";

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
    this.wakeUp();
  }

  public setInitialState() {
    this._state = {
      balance: {
        [CURRENCY_ENERGY]: ENERGY_MAX,
        [CURRENCY_COINS]: isProd ? 0 : 1000000,
        [CURRENCY_CRYSTALS]: isProd ? 0 : 1000000,
      },
      items: [{ commodity: COMMODITY_STARTER_PACK, quantity: 1 }],
      timers: {
        energy: game.nowSec,
        purchase: {},
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
    this.purgePreviousDates();
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
    const positionMeta = _.cloneDeep(SHOP.find((entry) => entry.id === id));
    if (!positionMeta) {
      return;
    }

    const commodity = positionMeta.commodity;

    // Check daily purchase limits
    if (
      positionMeta.dailyMax &&
      this.overDailyLimit(commodity, positionMeta.dailyMax)
    ) {
      console.log("Purchase failed. Expired daily max");
      return;
    }

    // Check if can claim
    if (positionMeta.claimable && !this.hasItem(commodity)) {
      console.log("Purchase failed. Nothing to claim");
      return;
    }

    // Check if enough money
    if (positionMeta.price && positionMeta.price.amount > 0) {
      // Flesh
      if (
        positionMeta.price.currency === "flesh" &&
        this._core.gameUser.dkt >= positionMeta.price.amount
      ) {
        this._core.gameUser.addDkt(-positionMeta.price.amount);

      // Event currency
      } else if (
        [CURRENCY_COINS, CURRENCY_CRYSTALS].includes(
          positionMeta.price.currency
        ) &&
        this._state.balance[positionMeta.price.currency] >=
          positionMeta.price.amount
      ) {
        this.modifyBalance(
          positionMeta.price.currency,
          -positionMeta.price.amount
        );
      } else {
        console.log("Purchase failed. Not enough currency");
        throw errors.NotEnoughCurrency;
      }
    }

    if (positionMeta.claimable && !this.hasItem(commodity)) {
      console.log("Purchase failed. Nothing to claim");
      return;
    }

    const itemEntry = this.getItem(commodity);
    const quantity = itemEntry ? itemEntry.quantity : 1;
    if (!this.increaseDailyCounter(id, quantity)) {
      console.log("Purchase failed. Overhead");
      return;
    }

    this.activate(id, quantity);
  }

  protected activate(id: number, quantity: number): void {
    console.log('Activate purchase', { id, quantity });
  }

  protected hasItem(commodity: string): boolean {
    const item = this._state.items.find((item) => item.commodity === commodity);
    return !!item && item.quantity > 0;
  }

  protected getItem(commodity: string): BattleItem {
    return this._state.items.find((item) => item.commodity === commodity);
  }

  protected purgePreviousDates(): void {
    const currentDate = new Date().toLocaleDateString("en-US");
    this._state.timers.purchase = _.pick(this._state.timers.purchase, currentDate);
  }

  protected overDailyLimit(commodity: string, max: number): boolean {
    const date = new Date().toLocaleDateString("en-US");
    const dateEntry = this._state.timers.purchase[date];
    if (dateEntry) {
      const commodityPurchases = dateEntry[commodity] || 0;
      if (commodityPurchases >= max) {
        return true;
      }
    }
    return false;
  }

  protected increaseDailyCounter(id: number, count: number): boolean {
    const positionMeta = _.cloneDeep(SHOP.find((entry) => entry.id === id));
    if (!positionMeta) {
      return false;
    }

    if (positionMeta.dailyMax) {
      const date = new Date().toLocaleDateString("en-US");
      const dateEntry = this._state.timers.purchase[date];
      const newCount = (dateEntry[id] || 0) + count;
      // Overhead
      if (newCount > count) {
        return false;
      // Increase counter
      } else {
        this._state.timers.purchase[date] = {
          ...dateEntry,
          [id]: newCount
        };
        console.log('Increased daily counter', this._state.timers.purchase[date]);
      }
    }

    return true;
  }
}
