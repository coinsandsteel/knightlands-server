import _ from "lodash";
import { BattleCore } from "./BattleCore";
import { BattleItem, BattleShopItemMeta, BattleUnit, BattleUserState } from "../types";
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
      items: [{ id: 1, quantity: 1 }],
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

  public purchase(id: number): BattleUnit[] {
    const positionMeta = _.cloneDeep(SHOP.find((entry) => entry.id === id));
    if (!positionMeta) {
      return;
    }

    const commodity = positionMeta.commodity;
    const itemEntry = this.getItem(commodity);
    const quantity = itemEntry ? itemEntry.quantity : 1;

    // Check daily purchase limits
    if (
      positionMeta.dailyMax && positionMeta.dailyMax > 0
      &&
      !this.dailyLimitExceeded(id, positionMeta.dailyMax)
      &&
      !this.increaseDailyCounter(id, quantity)
    ) {
      console.log("Purchase failed. Daily limit exeeded");
      return;
    }

    // Check if can claim
    if (positionMeta.claimable && !this.hasItem(id)) {
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

    return this.activate(positionMeta, quantity);
  }

  protected activateLootbox(unitsCount: number, probabilities: number[]): BattleUnit[] {
    const resultItems = [] as BattleUnit[];
    for (let i = 0; i < unitsCount; i++) {
      let tier = 1;
      let controlValue = Math.random() * 100;

      // Tier 3
      if (controlValue <= probabilities[2]) {
        tier = 3;
        // Tier 2
      } else if (controlValue <= probabilities[1]) {
        tier = 2;
      }

      const unit = this._core.inventory.getNewUnitByPropsRandom({ tier });
      this._core.inventory.addUnit(unit);
      resultItems.push(unit.serialize());
      console.log('Added unit from lootbox', { class: unit.class, tribe: unit.tribe, tier: unit.tier });
    }
    return resultItems;
  }

  protected activate(positionMeta: BattleShopItemMeta, quantity: number): BattleUnit[] {
    console.log('Activate purchase', { positionMeta, quantity });

    const entryIndex = this._state.items.findIndex(entry => entry.id === positionMeta.id);
    if (entryIndex === -1) {
      throw new Error(`Trying to activate unexisted item: #${positionMeta.id} x${quantity}`);
    }

    this._state.items[entryIndex].quantity--;
    if (this._state.items[entryIndex].quantity <= 0) {
      this._state.items.splice(entryIndex, 1);
    }
    this._core.events.items(this._state.items);

    let items = [] as BattleUnit[];
    if (
      positionMeta.content.units
      &&
      positionMeta.content.tierProbabilities
      &&
      positionMeta.content.tierProbabilities.length === 3
    ) {
      items = this.activateLootbox(positionMeta.content.units, positionMeta.content.tierProbabilities);

    } else if (positionMeta.content.energy) {
      this.modifyBalance(CURRENCY_ENERGY, positionMeta.content.energy);

    } else {
      throw new Error(`Malformed shop position format at #${positionMeta.id}`);
    }

    return items;
  }

  protected hasItem(id: number): boolean {
    const item = this._state.items.find((item) => item.id === id);
    return !!item && item.quantity > 0;
  }

  protected getItem(id: number): BattleItem {
    return this._state.items.find((item) => item.id === id);
  }

  protected purgePreviousDates(): void {
    const currentDate = new Date().toLocaleDateString("en-US");
    this._state.timers.purchase = _.pick(this._state.timers.purchase, currentDate);
  }

  protected dailyLimitExceeded(id: number, max: number): boolean {
    const date = new Date().toLocaleDateString("en-US");
    const dateEntry = this._state.timers.purchase[date];
    if (dateEntry) {
      const idPurchases = dateEntry[id] || 0;
      if (idPurchases >= max) {
        return true;
      }
    }
    return false;
  }

  protected increaseDailyCounter(id: number, count: number): boolean {
    const positionMeta = _.cloneDeep(SHOP.find((entry) => entry.id === id) as BattleShopItemMeta);
    if (!positionMeta) {
      return false;
    }

    if (positionMeta.dailyMax) {
      const date = new Date().toLocaleDateString("en-US");
      const dateEntry = this._state.timers.purchase[date];
      const newCount = (dateEntry? dateEntry[id] : 0) + count;
      // Overhead
      if (newCount > positionMeta.dailyMax) {
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
