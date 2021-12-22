import _ from "lodash";
import game from "../game";
import errors from "../knightlands-shared/errors";
import { XmasEvents } from "./XmasEvents";
import { XmasState } from "./types";
import Game from "../game";
import { 
  getFarmTimeData,
  getFarmIncomeData,
  getFarmUpgradeData,
  getTowerLevelBoundaries,
  getMainTowerPerkValue,
  farmConfig,
  TOWER_PERK_AUTOCYCLES_COUNT,
  CURRENCY_SANTABUCKS,
  CURRENCY_CHRISTMAS_POINTS,
  TOWER_PERK_UPGRADE,
  TOWER_PERK_INCOME,
  TOWER_PERK_CYCLE_DURATION,
  TOWER_PERK_SPEED,
  TOWER_PERK_SUPER_SPEED,
  TOWER_PERK_BOOST,
  TOWER_PERK_SUPER_BOOST,
  balance,
  slots,
  perksTree as perks
} from "../knightlands-shared/xmas";

export class XmasUser {
    private _state: XmasState;
    private _events: XmasEvents;
    private towerLevelBoundaries = {};
    private tierIntervals = {};

    constructor(state: XmasState | null, events: XmasEvents) {
        this._events = events;
        if (state) {
          this._state = state;
        } else {
          this.setInitialState();
        }
        this.towerLevelBoundaries = getTowerLevelBoundaries();
    }

    public getState(): XmasState {
      return this._state;
    }

    public setInitialState() {
      const state: XmasState = {
        levelGap: 1,
        tower: {
          level: 0,
          percentage: 0,
          exp: 0
        },
        slots,
        perks,
        balance
      };
      this._state = state;
      this.setInitialStats();
    }

    get sbBalance() {
      return this._state.balance[CURRENCY_SANTABUCKS];
    }

    tier6IsNotReady(tier) {
      return tier == 6 && this._state.slots[tier].stats.income.current.currencyPerCycle < 1;
    }

    public upgradeIsAllowed(tier) {
      if (tier == 1) {
        return true;
      }
      return this._state.slots[tier - 1].level >= 50;
    }

    canAffordUpgrade(tier) {
      return this._state.slots[tier].stats.upgrade.value <= this.sbBalance;
    }

    stopTimers(){
      for (let tier = 1; tier <= 9; tier++) {
        clearInterval(this.tierIntervals[tier]);
      }
    }

    launchTimer(tier, initial) {
      if (this.tierIntervals[tier]) {
        clearInterval(this.tierIntervals[tier]);
      }

      this._events.cycleStart(tier);
      if (initial) {
        this._state.slots[tier].lastLaunch = Game.now;
      }

      let slotData = this._state.slots[tier];
      this.tierIntervals[tier] = setTimeout(() => {
        let currentIncomeValue = slotData.stats.income.current;

        if (!this.tier6IsNotReady(tier)) {
          this._state.slots[tier].accumulated.currency += currentIncomeValue.currencyPerCycle;
        }
        this._state.slots[tier].accumulated.exp += currentIncomeValue.expPerCycle;
        
        this._events.accumulated(
          tier,
          this._state.slots[tier].accumulated.currency,
          this._state.slots[tier].accumulated.exp
        );

        if (slotData.progress.autoCyclesLeft > 0) {
          this.hookCycleFinished(tier);
          this.launchTimer(tier, false);
        } else {
          this.hookEpochFinished(tier);
        }

        this._events.flush();
      }, slotData.stats.cycleLength * 1000);
    }

    getAccumulatedProgressive(tier) {
      let perkData = this.getPerkData(tier, TOWER_PERK_AUTOCYCLES_COUNT);
      let autoCyclesMax = getMainTowerPerkValue(tier, TOWER_PERK_AUTOCYCLES_COUNT, perkData.level);
      let cycleLength = this._state.slots[tier].stats.cycleLength;
      let maxEfficientTime = cycleLength * (autoCyclesMax || 1);

      let power = this._state.slots[tier].stats.income.current;
      let passedTime = (Game.now - this._state.slots[tier].lastLaunch) / 1000;
      let time = Math.min(passedTime, maxEfficientTime);
      let multiplier = time == maxEfficientTime ? 1 : 0.5;

      return {
        currency: time * power.currencyPerSecond * multiplier,
        exp: time * power.expPerSecond * multiplier
      };
    }

    hookCycleFinished(tier) {
      if (this._state.slots[tier].progress.autoCyclesLeft > 0) {
        this._state.slots[tier].progress.autoCyclesLeft--;
        this._state.slots[tier].progress.autoCyclesSpent++;
      } else {
        this._state.slots[tier].progress.autoCyclesSpent = 0;
      }

      this._events.progress(tier, {
        autoCyclesLeft: this._state.slots[tier].progress.autoCyclesLeft,
        autoCyclesSpent: this._state.slots[tier].progress.autoCyclesSpent,
      });
    }

    resetCounters(tier) {
      let perkData = this.getPerkData(tier, TOWER_PERK_AUTOCYCLES_COUNT);
      let autoCyclesLeft = getMainTowerPerkValue(tier, TOWER_PERK_AUTOCYCLES_COUNT, perkData.level);
      this._state.slots[tier].progress.autoCyclesLeft = autoCyclesLeft;
      this._state.slots[tier].progress.autoCyclesSpent = 0;

      this._events.progress(
        tier,
        {
          autoCyclesLeft,
          autoCyclesSpent: 0
        }
      );
    }
    
    resetAccumulated(tier) {
      this._state.slots[tier].accumulated.exp = 0;
      this._state.slots[tier].accumulated.currency = 0;
      this._events.accumulated(tier, 0, 0);
    }
    
    hookEpochFinished(tier) {
      clearInterval(this.tierIntervals[tier]);
      this._events.cycleStop(tier);
      this.resetCounters(tier);
    }
    
    reCalculateCycleLength(tier, fireEvents){
      const cycleLength = this.getTierCycleLength(tier);
      this._state.slots[tier].stats.cycleLength = cycleLength;
      if (fireEvents) {
        this._events.cycleLength(tier, cycleLength);
      }
    }

    reCalculateUpgradeData(tier, fireEvents){
      const upgradeData = this.getTierUpgradePrice(tier);
      this._state.slots[tier].stats.upgrade = upgradeData;
      if (fireEvents) {
        this._events.upgrade(tier, upgradeData);
      }
    }
    
    reCalculateIncomeValue(tier, fireEvents){
      const incomeValue = this.getTierIncomeValue(tier);
      this._state.slots[tier].stats.income.current = incomeValue.current;
      this._state.slots[tier].stats.income.next = incomeValue.next;
      if (fireEvents) {
        this._events.income(tier, incomeValue.current, incomeValue.next);
      }
    }

    reCalculateStats(tier, fireEvents){
      this.reCalculateCycleLength(tier, fireEvents);
      this.reCalculateUpgradeData(tier, fireEvents);
      this.reCalculateIncomeValue(tier, fireEvents);
    }

    setInitialStats(){
      for (let tier = 1; tier <= 9; tier++) {
        this.reCalculateStats(tier, false);
      }
    }

    public updatePerkDependants(){
      for (let tier = 1; tier <= 9; tier++) {
        let perkData = this.getPerkData(tier, TOWER_PERK_AUTOCYCLES_COUNT);
        if (!perkData) {
          continue;
        }

        let autoCyclesMax = getMainTowerPerkValue(tier, TOWER_PERK_AUTOCYCLES_COUNT, perkData.level);
        let autoCyclesLeft = autoCyclesMax - this._state.slots[tier].progress.autoCyclesSpent;
      
        this._state.slots[tier].progress.autoCyclesLeft = autoCyclesLeft;
        this._state.slots[tier].progress.autoCyclesSpent = 0;
  
        this._events.progress(
          tier,
          {
            autoCyclesLeft,
            autoCyclesSpent: 0
          }
        );
      }
    }

    public harvest(tier) {
      let accumulated = this.getAccumulatedProgressive(tier);
      this.addExpirience(accumulated.exp);
      this.increaseBalance(farmConfig[tier].currency, accumulated.currency);
      
      this.resetAccumulated(tier);
      this.resetCounters(tier);
      this.launchTimer(tier, true);
    }

    public upgradeSlot(tier){
      this.decreaseBalance(
        CURRENCY_SANTABUCKS,
        this._state.slots[tier].stats.upgrade.value
      );

      this._state.slots[tier].level += this._state.levelGap;
      this._events.level(tier, this._state.slots[tier].level);

      this.reCalculateStats(tier, true);
      this.launchTimer(tier, true);
    }

    public commitPerks(perks) {
      let newPerksSum = 0;
      for (let currencyName in perks) {
        for (let tier in perks[currencyName].tiers) {
          newPerksSum += _.sum(
            _.map(
              Object.values(perks[currencyName].tiers[tier]),
              "level"
            )
          );
        }
      }

      let newUnlockedBranchesCount = 0;
      for (let currencyName in perks) {
        newUnlockedBranchesCount += perks[currencyName].unlocked ? 1 : 0;
      }

      if (newPerksSum > this._state.tower.level - newUnlockedBranchesCount - 1) {
        return;
      }

      for (let currencyName in perks) {
        this._state.perks[currencyName].unlocked = perks[currencyName].unlocked;
        for (let tier in perks[currencyName].tiers) {
          for (let perkName in perks[currencyName].tiers[tier]) {
            this._state.perks[currencyName].tiers[tier][perkName].level = perks[currencyName].tiers[tier][perkName].level;
          }
        }
      }

      this._events.perks(this._state.perks);
      this.updatePerkDependants();
    }

    async updateLevelGap(value) {
      this._state.levelGap = value;
      this._events.levelGap(value);

      for (let tier = 1; tier <= 9; tier++) {
        this.reCalculateUpgradeData(tier, true);
        this.reCalculateIncomeValue(tier, true);
      }
    }

    private addExpirience(value) {
      this._state.tower.exp += value;

      let currentExp = this._state.tower.exp;
      let currentLevel = this._state.tower.level;
      let newLevel = currentLevel + 1;
      let currentLevelExpStart = this.towerLevelBoundaries[currentLevel];
      let currentLevelExpEnd = this.towerLevelBoundaries[newLevel];

      while (this.towerLevelBoundaries[newLevel] < this._state.tower.exp) {
        currentLevelExpStart = this.towerLevelBoundaries[newLevel];
        currentLevelExpEnd = this.towerLevelBoundaries[newLevel + 1];
        newLevel++;
      }

      if (newLevel > currentLevel) {
        this._state.tower.level = newLevel - 1;
      }

      let expGap = currentLevelExpEnd - currentLevelExpStart;
      let currentGap = currentExp - currentLevelExpStart;

      this._state.tower.percentage = Math.floor(
        currentGap * 100 / expGap
      );

      this._events.tower(this._state.tower);
    }

    private increaseBalance(currency, amount) {
      this._state.balance[currency] += amount;
      this._events.balance(currency, this._state.balance[currency]);
    }
    
    private decreaseBalance(currency, amount) {
      this._state.balance[currency] -= amount;
      this._events.balance(currency, this._state.balance[currency]);
    }
    
    private getPerkData(tier, perkName) {
      let tierCurrency = farmConfig[tier].currency;
      return this._state.perks[tierCurrency].tiers[
        tierCurrency === CURRENCY_CHRISTMAS_POINTS ? tier : "all"
      ][perkName];
    }
    
    private getTierCycleLength(tier) {
      let cyclePerkData = this.getPerkData(tier, TOWER_PERK_CYCLE_DURATION);
      let stat = getFarmTimeData(tier, {
        cycleDurationPerkLevel: cyclePerkData ? cyclePerkData.level : 0,
        [TOWER_PERK_SPEED]: false,
        [TOWER_PERK_SUPER_SPEED]: false
      });
      return stat.cycleLength;
    }

    private getTierIncomeValue(tier) {
      let level = this._state.slots[tier].level;
      let incomePerkData = this.getPerkData(tier, TOWER_PERK_INCOME);
      let cyclePerkData = this.getPerkData(tier, TOWER_PERK_CYCLE_DURATION);
      let upgradeData = this.getTierUpgradePrice(tier);
      let params = {
        incomePerkLevel: incomePerkData ? incomePerkData.level : 0,
        cycleDurationPerkLevel: cyclePerkData ? cyclePerkData.level : 0,
        [TOWER_PERK_BOOST]: false,
        [TOWER_PERK_SUPER_BOOST]: false
      };
      let currentStat = getFarmIncomeData(tier, level, params);
      let nextStat = getFarmIncomeData(tier, upgradeData.nextLevel, params);
      return { current: currentStat, next: nextStat };
    }
    
    private getTierUpgradePrice(tier) {
      let levelGap = 1;
      let level = this._state.slots[tier].level;
      let showMaxPrice = this._state.levelGap === 10000;
      if (level > 0) {
        levelGap = showMaxPrice ? null : this._state.levelGap;
      }

      let perkData = this.getPerkData(tier, TOWER_PERK_UPGRADE);
      let accumulatedPrice = 0;
      let maxAffordableLevel = level;
      let imaginaryAvailableResources = this._state.balance[CURRENCY_SANTABUCKS];
      let stat = null;
      for (
        let tickLevel = 1;
        showMaxPrice ? imaginaryAvailableResources >= 0 : tickLevel <= levelGap;
        tickLevel++
      ) {
        stat = getFarmUpgradeData(tier, level + tickLevel, {
          upgradePerkLevel: perkData ? perkData.level : 0
        });
        accumulatedPrice += stat.upgrade;
        imaginaryAvailableResources -= stat.upgrade;
        maxAffordableLevel = level + tickLevel;
        if (level === 0) {
          break;
        }
      }

      if (level > 0 && showMaxPrice) {
        accumulatedPrice -= stat.upgrade;
        maxAffordableLevel--;
      }

      return {
        value: accumulatedPrice,
        nextLevel: maxAffordableLevel
      };
    }
}