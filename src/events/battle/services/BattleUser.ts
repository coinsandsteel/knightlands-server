import _ from "lodash";
import { BattleCore } from "./BattleCore";
import * as moment from 'moment';
import {
  BattleItem,
  BattleShopItemMeta,
  BattleUnit,
  BattleUserState,
} from "../types";
import {
  BATTLE_MAX_DUELS_DAILY,
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
import { SETTINGS } from "../meta";

const isProd = process.env.ENV == "prod";

const ENERGY_MAX = 36;
//const ENERGY_CYCLE_SEC = (15 * 60) / 2;
const ENERGY_CYCLE_SEC = 1;
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
      pvpScore: 0,
      balance: {
        [CURRENCY_ENERGY]: ENERGY_MAX,
        [CURRENCY_COINS]: 0,
        [CURRENCY_CRYSTALS]: 0,
      },
      items: [{ id: 1, quantity: 1 }],
      counters: {
        energy: game.nowSec,
        purchase: {},
        duels: {},
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
    this.updatePvpScore();
  }

  protected getAccumulatedEnergy(): number {
    let cycleLength = ENERGY_CYCLE_SEC;
    let energyPerCycle = ENERGY_AMOUNT_PER_CYCLE;
    let energyPerSecond = energyPerCycle / cycleLength;

    let passedTime = game.nowSec - this._state.counters.energy;
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
      this._state.counters.energy = game.nowSec;

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

  public modifyBalance(currency: string, amount: number, force?: boolean): void {
    //console.log('modifyBalance', { currency, amount });
    this._state.balance[currency] += amount;

    if (this._state.balance[currency] < 0) {
      this._state.balance[currency] = 0;
    }

    this._core.events.balance(this._state.balance);

    if (currency === CURRENCY_ENERGY && amount >= 0 && this.energy > ENERGY_MAX && !force) {
      this._state.balance[CURRENCY_ENERGY] = ENERGY_MAX;
    }

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
    if (!rewardData || !rewardData.canClaim || rewardData.claimed) {
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

  public async updatePvpScore(): Promise<any> {
    const rankData = await game.battleManager.getUserRankData(
      this._core.gameUser.id
    );
    this._state.pvpScore = (rankData ? rankData.pvp : null) || 0;
    this._core.events.pvpScore(this._state.pvpScore);
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
        (u) => u.unit.template
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

  public purchase(id: number, tribe?: string): BattleUnit[] {
    const positionMeta = _.cloneDeep(
      SHOP.find((entry) => entry.id === id)
    ) as BattleShopItemMeta;
    if (!positionMeta) {
      return;
    }

    const itemEntry = this.getItem(id);
    const quantity = itemEntry ? itemEntry.quantity : 1;

    // Check daily purchase limits
    if (
      positionMeta.dailyMax &&
      positionMeta.dailyMax > 0 &&
      !this.dailyPurchaseLimitExceeded(id, positionMeta.dailyMax) &&
      !this.increaseDailyPurchaseCounter(id, quantity)
    ) {
      //console.log("Purchase failed. Daily limit exeeded");
      return;
    }

    // Check if can claim
    if (positionMeta.claimable && !this.hasItem(id)) {
      //console.log("Purchase failed. Nothing to claim");
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
        //console.log("Purchase failed. Not enough currency");
        throw errors.NotEnoughCurrency;
      }
    }

    return this.activate(positionMeta, quantity, tribe);
  }

  protected activateLootbox(
    unitsCount: number,
    probabilities: number[],
    tribe?: string,
    unitClass?: string
  ): BattleUnit[] {
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

      const params = { tier } as {
        tier: number;
        tribe?: string;
        class?: string;
      };
      if (tribe) {
        params.tribe = tribe;
      }
      if (unitClass) {
        params.class = unitClass;
      }

      const unit = this._core.inventory.getNewUnitByPropsRandom(params);
      if (unit) {
        this._core.inventory.addUnit(unit);
        resultItems.push(unit.serialize());
      }
      /*console.log("Added unit from lootbox", {
        class: unit.class,
        tribe: unit.tribe,
        tier: unit.tier,
      });*/
    }
    return resultItems;
  }

  protected activate(
    positionMeta: BattleShopItemMeta,
    quantity: number,
    tribe?: string
  ): BattleUnit[] {
    //console.log("Activate purchase", { positionMeta, quantity });

    const entryIndex = this._state.items.findIndex(
      (entry) => entry.id === positionMeta.id
    );
    if (entryIndex !== -1) {
      this._state.items[entryIndex].quantity--;
      if (this._state.items[entryIndex].quantity <= 0) {
        this._state.items.splice(entryIndex, 1);
      }
      this._core.events.items(this._state.items);
    }

    let items = [] as BattleUnit[];
    if (positionMeta.content.units) {
      const tierProbabilities = positionMeta.content.tierProbabilities ?? [100, 0, 0];
      const unitTribe = positionMeta.content.canSelectTribe ? tribe : null;
      const unitClasses = positionMeta.content.unitClasses ?? null;

      if (unitClasses) {
        for (let unitClass in unitClasses) {
          items.push(
            ...this.activateLootbox(
              unitClasses[unitClass],
              tierProbabilities,
              unitTribe,
              unitClass
            )
          );
        }
      } else {
        items = this.activateLootbox(
          positionMeta.content.units,
          tierProbabilities,
          unitTribe
        );
      }
    } else if (positionMeta.content.energy) {
      this.modifyBalance(CURRENCY_ENERGY, positionMeta.content.energy, true);
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

  public addDailyReward(): void {
    if (this.hasItem(2)) {
      return;
    }
    this._state.items.push({ id: 2, quantity: 1 });
    this._core.events.items(this._state.items);
  }

  protected purgePreviousDates(): void {
    const currentDate = moment.utc().format('DD/MM/YYYY');
    this._state.counters.purchase = _.pick(
      this._state.counters.purchase,
      currentDate
    );
    this._state.counters.duels = _.pick(
      this._state.counters.duels,
      currentDate
    );
    this._core.events.counters(this._state.counters);
  }

  public purgeCounters(): void {
    this._state.counters.purchase = {};
    this._state.counters.duels = {};
    this._core.events.counters(this._state.counters);
  }

  public dailyDuelsLimitExceeded(): boolean {
    const date = moment.utc().format('DD/MM/YYYY');
    const dateEntry = this._state.counters.duels[date];
    return (dateEntry || 0) >= BATTLE_MAX_DUELS_DAILY;
  }

  protected dailyPurchaseLimitExceeded(id: number, max: number): boolean {
    const date = moment.utc().format('DD/MM/YYYY');
    const dateEntry = this._state.counters.purchase[date];
    if (dateEntry) {
      const idPurchases = dateEntry[id] || 0;
      if (idPurchases >= max) {
        return true;
      }
    }
    return false;
  }

  public increaseDailyDuelsCounter(): boolean {
    const date = moment.utc().format('DD/MM/YYYY');
    const dateEntry = this._state.counters.duels[date];
    const newCount = (dateEntry || 0) + 1;

    // Overhead
    if (newCount > BATTLE_MAX_DUELS_DAILY) {
      return false;
      // Increase counter
    } else {
      this._state.counters.duels[date] = newCount;
      /*console.log(
        "Increased daily duels counter",
        this._state.counters.duels[date]
      );*/
    }

    this._core.events.counters(this._state.counters);

    return true;
  }

  public increaseDailyPurchaseCounter(id: number, count: number): boolean {
    const positionMeta = _.cloneDeep(
      SHOP.find((entry) => entry.id === id) as BattleShopItemMeta
    );
    if (!positionMeta) {
      return false;
    }

    if (positionMeta.dailyMax) {
      const date = moment.utc().format('DD/MM/YYYY');
      const dateEntry = this._state.counters.purchase[date];
      const newCount = (dateEntry ? dateEntry[id] : 0) + count;
      // Overhead
      if (newCount > positionMeta.dailyMax) {
        return false;
        // Increase counter
      } else {
        this._state.counters.purchase[date] = {
          ...dateEntry,
          [id]: newCount,
        };
        /*console.log(
          "Increased daily counter",
          this._state.counters.purchase[date]
        );*/
      }
    }

    this._core.events.counters(this._state.counters);

    return true;
  }
}
