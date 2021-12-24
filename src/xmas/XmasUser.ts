import _ from "lodash";
import { XmasEvents } from "./XmasEvents";
import { XmasState } from "./types";
import Game from "../game";
import { 
  getFarmTimeData,
  getFarmIncomeData,
  getFarmUpgradeData,
  getUpgradeTotalPriceAtLevel,
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
  perksTree as perks,
  burstPerksTree as burstPerks,
  perksUnlockMap,
  CURRENCY_GOLD,
  CURRENCY_SHINIES,
  CURRENCY_UNIT_ESSENCE,
  TOWER_PERK_SLEEP,
  TOWER_PERK_PRESENT
} from "../knightlands-shared/xmas";
import { CPoints } from "./CPoints";
import User from "../user";

const bounds = require("binary-search-bounds");

const CURRENCY_TO_ITEM = {
  [CURRENCY_GOLD]: 2383,
  [CURRENCY_SHINIES]: 2480,
  [CURRENCY_UNIT_ESSENCE]: 2978
}

export class XmasUser {
    private _state: XmasState;
    private _events: XmasEvents;
    private towerLevelBoundaries = {};
    private tierIntervals = {};
    private activePerkTimeouts = {};
    private _cpoints: CPoints;
    private _user: User;

    constructor(state: XmasState | null, events: XmasEvents, user: User) {
        this.towerLevelBoundaries = getTowerLevelBoundaries();
        this._events = events;
        this._user = user;

        if (state) {
          this._state = state;
          this.wakeUp();
        } else {
          this.setInitialState();
        }

        if (!this._state.cpoints) {
          this._state.cpoints = {} as any;
        }

        this._cpoints = new CPoints(this._state.cpoints, this._user);
    }

    public async init() {
      await this._cpoints.tryClaimDkt();
    }

    public getState(): XmasState {
      return this._state;
    }

    public setInitialState() {
      const state: XmasState = {
        rebalance: {
          price: 0,
          counter: 1
        },
        levelGap: 1,
        tower: {
          level: 1,
          percentage: 0,
          exp: 0
        },
        slots,
        burstPerks,
        perks,
        balance,
        cpoints: {
          lastClaimed: 0,
          pointsPool: 0,
          shares: 0,
          sharesPool: 0,
          score: 0
        }
      };
      this._state = state;
      this.recalculateStats(false);
    }

    get sbBalance() {
      return this._state.balance[CURRENCY_SANTABUCKS];
    }

    tier6IsNotReady(tier) {
      return tier == 6 && this._state.slots[tier].stats.income.current.currencyPerCycle < 1;
    }

    wakeUp() {
      for (let tier = 1; tier <= 9; tier++) {
        let tierData = this._state.slots[tier];
        if (!tierData.launched) {
          continue;
        }
        
        let accumulated = this.getAccumulatedProgressive(tier);
        if (this.tier6IsNotReady(tier)) {
          this._state.slots[tier].accumulated.currency = 0;
        } else {
          this._state.slots[tier].accumulated.currency = accumulated.currency;
        }
        this._state.slots[tier].accumulated.exp = accumulated.exp;
        this._state.slots[tier].launched = accumulated.launched;
        this._state.slots[tier].progress.autoCyclesLeft = accumulated.autoCyclesLeft;
        this._state.slots[tier].progress.autoCyclesSpent = accumulated.autoCyclesSpent;
        this._state.slots[tier].progress.percentage = accumulated.percentage;

        if (this._state.slots[tier].launched) {
          this.launchTimer(tier, false);
        }
      }
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

    shutdown() {
      this.removeTimers();
      this.disableActivePerks();
      this.recalculateStats(false);
    }

    launchActivePerkTimeout(currency, tier, perkName){
      let perkData = this.getPerkData(tier, perkName, currency);
      let perkDuration = getMainTowerPerkValue(tier, perkName, perkData ? perkData.level : 0, currency);
      
      console.log('Active perk launched:', perkDuration + ' sec.', { currency, tier, perkName}, perkData);
      this.activePerkTimeouts[`${currency}_${tier}_${perkName}`] = setTimeout(() => {
        console.log('Active perk stoped:', {currency, tier, perkName});
        this._state.perks[currency].tiers[tier][perkName].active = false;
        if (tier !== 'all') {
          this.reCalculateTierStats(tier, true);
        } else {
          for (let tierNum in farmConfig) {
            if (currency === farmConfig[tierNum].currency) {
              this.reCalculateTierStats(tierNum, true);
            }
          }
        }
      }, perkDuration * 1000);
    }
    
    removeTimers(){
      for (let tier = 1; tier <= 9; tier++) {
        clearInterval(this.tierIntervals[tier]);
      }
      for (let key in this.activePerkTimeouts) {
        clearTimeout(this.activePerkTimeouts[key]);
      }
    }

    disableActivePerks(){
      for (let currency in this._state.perks) {
        for (let tier in this._state.perks[currency].tiers) {
          for (let perkName in this._state.perks[currency].tiers[tier]) {
            this._state.perks[currency].tiers[tier][perkName].active = false;
          }
        }
      }
    }

    launchTimer(tier, initial) {
      if (this.tierIntervals[tier]) {
        clearInterval(this.tierIntervals[tier]);
      }

      this._events.cycleStart(tier);
      if (initial) {
        this._state.slots[tier].launched = true;
        this._state.slots[tier].lastLaunch = Game.now;
        this._events.launched(tier, true);
      }

      let slotData = this._state.slots[tier];
      let innerCycleModifier = ((100 - slotData.progress.percentage) / 100) || 1;

      this.tierIntervals[tier] = setTimeout(() => {
        let currentIncomeValue = slotData.stats.income.current;

        if (!this.tier6IsNotReady(tier)) {
          this._state.slots[tier].accumulated.currency += (currentIncomeValue.currencyPerCycle * innerCycleModifier);
        }
        this._state.slots[tier].accumulated.exp += (currentIncomeValue.expPerCycle * innerCycleModifier);
        
        this._events.accumulated(
          tier,
          slotData.accumulated.currency,
          slotData.accumulated.exp
        );

        if (slotData.progress.autoCyclesLeft > 0) {
          this.hookCycleFinished(tier);
          this.launchTimer(tier, false);
        } else {
          this._state.slots[tier].launched = false;
          this.hookEpochFinished(tier);
        }

        this._events.flush();
      }, innerCycleModifier * slotData.stats.cycleLength * 1000);
    }

    getAccumulatedProgressive(tier) {
      let perkData = this.getPerkData(tier, TOWER_PERK_AUTOCYCLES_COUNT);
      let autoCyclesMax = getMainTowerPerkValue(tier, TOWER_PERK_AUTOCYCLES_COUNT, perkData ? perkData.level : 0);
      let cycleLength = this._state.slots[tier].stats.cycleLength;
      let maxEfficientTime = cycleLength * (autoCyclesMax || 1);

      let power = this._state.slots[tier].stats.income.current;
      let passedTime = (Game.now - this._state.slots[tier].lastLaunch) / 1000;
      let endReached = passedTime >= maxEfficientTime;
      let time = Math.min(passedTime, maxEfficientTime);
      let multiplier = endReached ? 1 : 0.5;

      let percentage = 0;
      let autoCyclesLeft = autoCyclesMax;
      let autoCyclesSpent = 0;

      if (!endReached) {
        let passedTimeInsideCycle = passedTime % cycleLength;
        percentage = Math.floor(passedTimeInsideCycle * 100 / cycleLength);
        autoCyclesSpent = Math.floor(passedTime / cycleLength);
        autoCyclesLeft = autoCyclesMax - autoCyclesSpent;
      }

      return {
        launched: !endReached,
        percentage,
        autoCyclesLeft,
        autoCyclesSpent,
        currency: time * power.currencyPerSecond * multiplier,
        exp: time * power.expPerSecond * multiplier
      };
    }

    hookCycleFinished(tier) {
      this._state.slots[tier].progress.percentage = 100;

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
      let autoCyclesLeft = getMainTowerPerkValue(tier, TOWER_PERK_AUTOCYCLES_COUNT, perkData ? perkData.level : 0);
      this._state.slots[tier].progress.autoCyclesLeft = autoCyclesLeft;
      this._state.slots[tier].progress.autoCyclesSpent = 0;
      this._state.slots[tier].progress.percentage = 0;

      this._events.progress(
        tier,
        {
          percentage: 0,
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
      this._events.launched(tier, false);
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

    reCalculateTierStats(tier, fireEvents){
      this.reCalculateCycleLength(tier, fireEvents);
      this.reCalculateUpgradeData(tier, fireEvents);
      this.reCalculateIncomeValue(tier, fireEvents);
    }

    getTotalExpIncomePerSecond() {
      let totalExpIncomePerSecond = 0;
      for (let tier = 1; tier <= 9; tier++) {
        totalExpIncomePerSecond += this._state.slots[tier].stats.income.current.expPerSecond;
      }
      return totalExpIncomePerSecond;
    }

    reCalculatePerkPrices(sendEvents){
      let totalExpIncomePerSecond = this.getTotalExpIncomePerSecond();

      // Perks
      for (let currency in this._state.perks) {
        for (let tier in this._state.perks[currency].tiers) {
          for (let perkName in this._state.perks[currency].tiers[tier]) {
            if ([TOWER_PERK_SPEED, TOWER_PERK_SUPER_SPEED, TOWER_PERK_BOOST, TOWER_PERK_SUPER_BOOST].includes(perkName)) {
              this._state.perks[currency].tiers[tier][perkName].price = 
              totalExpIncomePerSecond * this._state.perks[currency].tiers[tier][perkName].level / 100;
            }
          }
        }
      }
      
      // Burst perks
      for (let perkName in this._state.burstPerks) {
        this._state.burstPerks[perkName].price = totalExpIncomePerSecond * this._state.burstPerks[perkName].level / 100;
      }

      // Perks reset price
      this._state.rebalance.price = totalExpIncomePerSecond * this._state.tower.level * this._state.rebalance.counter * 360;

      if (sendEvents) {
        this._events.perks(this._state.perks);
        this._events.burstPerks(this._state.burstPerks);
        this._events.rebalance(this._state.rebalance);
      }
    }

    recalculateStats(sendEvents){
      for (let tier = 1; tier <= 9; tier++) {
        this.reCalculateTierStats(tier, sendEvents);
      }
      this.reCalculatePerkPrices(sendEvents);
    }

    public rebalancePerks(){
      if (this._state.rebalance.price > this.sbBalance) {
        return;
      }

      this.decreaseBalance(CURRENCY_SANTABUCKS, this._state.rebalance.price);

      for (let currency in this._state.perks) {
        for (let tier in this._state.perks[currency].tiers) {
          for (let perkName in this._state.perks[currency].tiers[tier]) {
              this._state.perks[currency].tiers[tier][perkName].level = 0;
              if (perkName != TOWER_PERK_AUTOCYCLES_COUNT) {
                this._state.perks[currency].tiers[tier][perkName].enabled = false;
              }
          }
        }
      }
      
      for (let perkName in this._state.burstPerks) {
        this._state.burstPerks[perkName].level = 0;
      }
      
      this._state.rebalance.counter++;
      this.reCalculatePerkPrices(true);
    }

    activatePerk({ currency, tier, perkName }){
      if (!tier) {
        tier = 'all';
      }
      
      if (
        this.activePerkIsActiveLOL(currency, tier, perkName)
        ||
        !this.activePerkCooldownPassed(currency, tier, perkName)
      ) {
        return;
      }

      this._state.perks[currency].tiers[tier][perkName].active = true;
      this._state.perks[currency].tiers[tier][perkName].lastActivated = Game.now;

      for (let tierNum in farmConfig) {
        if (currency !== farmConfig[tierNum].currency) {
          continue;
        }

        if (
          currency === CURRENCY_CHRISTMAS_POINTS
          &&
          tier != tierNum
        ) {
          continue;
        }

        this.reCalculateTierStats(tierNum, true);
        this.harvest(tierNum);
      }

      this.launchActivePerkTimeout(currency, tier, perkName);
    }

    activateSlotPerk(tier, perkName){
      let freePerkPoints = Math.floor(this._state.slots[tier].level / 25);
      let enabledPerksCount = 
        Object.values(this._state.slots[tier].slotPerks)
        .map(value => value ? 1 : 0)
        .reduce(
          (previousValue, currentValue) => previousValue + currentValue,
          0
        );

      if (freePerkPoints <= enabledPerksCount) {
        return;
      }

      this._state.slots[tier].slotPerks[perkName] = true;
      this.reCalculateTierStats(tier, true);
    }

    public updatePerkDependants(){
      for (let tier = 1; tier <= 9; tier++) {
        let perkData = this.getPerkData(tier, TOWER_PERK_AUTOCYCLES_COUNT);
        if (!perkData) {
          continue;
        }

        let autoCyclesMax = getMainTowerPerkValue(tier, TOWER_PERK_AUTOCYCLES_COUNT, perkData ? perkData.level : 0);
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

    public async harvest(tier) {
      let accumulated = this.getAccumulatedProgressive(tier);
      this.addExpirience(accumulated.exp);

      const currency = farmConfig[tier].currency;

      if (currency == CURRENCY_CHRISTMAS_POINTS) {
        // increase cp for the server too
        this._events.cpoints(await this._cpoints.addPoints(accumulated.currency));
      } else if (currency == CURRENCY_GOLD || currency == CURRENCY_SHINIES || currency == CURRENCY_UNIT_ESSENCE) {
        // add items
        await this._user.inventory.addItemTemplate(CURRENCY_TO_ITEM[currency], Math.floor(accumulated.currency));
      } else {
        this.increaseBalance(currency, accumulated.currency);
      }
      
      this.resetAccumulated(tier);
      this.resetCounters(tier);
      this.launchTimer(tier, true);
    }

    public addSantabucks(amount: number) {
      this.increaseBalance(CURRENCY_SANTABUCKS, amount)
    }

    public upgradeSlot(tier){
      let tierCurrency = farmConfig[tier].currency;
      if (process.env.ENV == "prod" && !this._state.perks[tierCurrency].unlocked) {
        return;
      }
      
      let tierData = this._state.slots[tier];
      let upgradePrice = tierData.stats.upgrade.value;
      let nextLevel = tierData.stats.upgrade.nextLevel;

      if (tierData.level === 0) {
        let perkData = this.getPerkData(tier, TOWER_PERK_UPGRADE);
        let price = getUpgradeTotalPriceAtLevel(getFarmUpgradeData(tier, {
          upgradePerkLevel: perkData ? perkData.level : 0
        }), 1);
        upgradePrice = price;
        nextLevel = 1;
      }

      this.decreaseBalance(CURRENCY_SANTABUCKS, upgradePrice);
      this._state.slots[tier].level = nextLevel;
      this._events.level(tier, this._state.slots[tier].level);

      this.reCalculateTierStats(tier, true);
      this.reCalculatePerkPrices(true);

      if (this._state.slots[tier].level === 1) {
        this.launchTimer(tier, true);
      }
    }

    public commitPerks({ perks, burstPerks }) {
      // ==== PERKS ====
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

      if (newPerksSum > this._state.tower.level - newUnlockedBranchesCount) {
        return;
      }

      // Perk downgrade is prohibited
      for (let currencyName in perks) {
        this._state.perks[currencyName].unlocked = perks[currencyName].unlocked;
        for (let tier in perks[currencyName].tiers) {
          for (let perkName in perks[currencyName].tiers[tier]) {
            if (this._state.perks[currencyName].tiers[tier][perkName].level > perks[currencyName].tiers[tier][perkName].level) {
              return;
            }
          }
        }
      }
      for (let perkName in burstPerks) {
        if (this._state.burstPerks[perkName].level > burstPerks[perkName].level) {
          return;
        }
      }

      // Update actual values
      let enableSleepPerk = true;
      let enablePresentPerk = true;

      for (let currencyName in perks) {
        this._state.perks[currencyName].unlocked = perks[currencyName].unlocked;
        for (let tier in perks[currencyName].tiers) {
          for (let perkName in perks[currencyName].tiers[tier]) {
            this._state.perks[currencyName].tiers[tier][perkName].level = perks[currencyName].tiers[tier][perkName].level;
            
            // Enable next perks in the branch
            if (this._state.perks[currencyName].tiers[tier][perkName].level > 0) {
              let perksToEnable = perksUnlockMap[currencyName][tier][perkName];
              if (perksToEnable) {
                perksToEnable.forEach((nextPerkName) => {
                  if (this._state.perks[currencyName].tiers[tier][nextPerkName]) {
                    this._state.perks[currencyName].tiers[tier][nextPerkName].enabled = true;
                  }
                });
              }
            }

            // Try to unlock the "sleep perk"
            if (
              [CURRENCY_UNIT_ESSENCE, CURRENCY_SANTABUCKS, CURRENCY_GOLD].includes(currencyName)
              &&
              this._state.perks[currencyName].tiers[tier][perkName].level == 0
            ) {
              enableSleepPerk = false;
            }

            // Try to unlock the "present perk"
            if (
              [CURRENCY_SHINIES, CURRENCY_CHRISTMAS_POINTS].includes(currencyName)
              &&
              this._state.perks[currencyName].tiers[tier][perkName].level == 0
            ) {
              enablePresentPerk = false;
            }
          }
        }
      }

      if (enableSleepPerk) {
        this._state.burstPerks[TOWER_PERK_SLEEP].enabled = true;
        this._state.burstPerks[TOWER_PERK_SLEEP].level = burstPerks[TOWER_PERK_SLEEP].level;
      }

      if (enablePresentPerk) {
        this._state.burstPerks[TOWER_PERK_PRESENT].enabled = true;
        this._state.burstPerks[TOWER_PERK_PRESENT].level = burstPerks[TOWER_PERK_PRESENT].level;
      }

      this.updatePerkDependants();
      this.recalculateStats(true);
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
    
    private getPerkData(tier, perkName, currency?: string) {
      if (!currency && tier !== 'all') {
        currency = farmConfig[tier].currency;
      }
      return this._state.perks[currency].tiers[
        currency === CURRENCY_CHRISTMAS_POINTS ? tier : "all"
      ][perkName];
    }
    
    private activePerkIsActiveLOL(currency, tier, perkName) {
      let perkData = this.getPerkData(tier, perkName, currency);
      if (!perkData) {
        return false;
      }
      let perkDuration = getMainTowerPerkValue(tier, perkName, perkData.level, currency);
      let perkIsActive = (Game.now < perkData.lastActivated + perkDuration * 1000) && !!perkData.active;
      return perkIsActive;
    }

    private activePerkCooldownPassed(currency, tier, perkName) {
      let perkData = this.getPerkData(tier, perkName, currency);
      if (!perkData) {
        return false;
      }
      let perkDuration = getMainTowerPerkValue(tier, perkName, perkData.level, currency);
      return Game.now >= perkData.lastActivated + perkDuration * 1000 + 3600 * 1000;
    }

    private getTierCycleLength(tier) {
      let cyclePerkData = this.getPerkData(tier, TOWER_PERK_CYCLE_DURATION);
      let speedPerkIsActive = this.activePerkIsActiveLOL(null, tier, TOWER_PERK_SPEED);
      let superSpeedPerkIsActive = this.activePerkIsActiveLOL(null, tier, TOWER_PERK_SUPER_SPEED);

      let stat = getFarmTimeData(tier, {
        cycleDurationPerkLevel: cyclePerkData ? cyclePerkData.level : 0,
        [TOWER_PERK_SPEED]: speedPerkIsActive,
        [TOWER_PERK_SUPER_SPEED]: superSpeedPerkIsActive
      });

      return stat.cycleLength;
    }

    private getTierIncomeValue(tier) {
      let level = this._state.slots[tier].level;

      let incomePerkData = this.getPerkData(tier, TOWER_PERK_INCOME);
      let cyclePerkData = this.getPerkData(tier, TOWER_PERK_CYCLE_DURATION);
      let upgradeData = this.getTierUpgradePrice(tier);

      let boostPerkIsActive = this.activePerkIsActiveLOL(null, tier, TOWER_PERK_BOOST);
      let superBoostPerkIsActive = this.activePerkIsActiveLOL(null, tier, TOWER_PERK_SUPER_BOOST);
      
      let params = {
        incomePerkLevel: incomePerkData ? incomePerkData.level : 0,
        cycleDurationPerkLevel: cyclePerkData ? cyclePerkData.level : 0,
        [TOWER_PERK_BOOST]: boostPerkIsActive,
        [TOWER_PERK_SUPER_BOOST]: superBoostPerkIsActive
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
        levelGap = this._state.levelGap;
      }

      let perkData = this.getPerkData(tier, TOWER_PERK_UPGRADE);
      let accumulatedPrice = 0;
      let maxAffordableLevel = level;
      let imaginaryAvailableResources = this._state.balance[CURRENCY_SANTABUCKS];
      const upgradeData = getFarmUpgradeData(tier, {
        upgradePerkLevel: perkData ? perkData.level : 0
      });

      const currentTotalPrice = getUpgradeTotalPriceAtLevel(upgradeData, level);

      if (showMaxPrice) {
        let start = level;
        let end = level + levelGap;

        while (end - start > 1) {
          let mid = Math.floor((start + end) / 2);
          accumulatedPrice = getUpgradeTotalPriceAtLevel(upgradeData, mid);
          if (accumulatedPrice - currentTotalPrice <= imaginaryAvailableResources) {
            start = mid;
          } else {
            end = mid;
          }

          maxAffordableLevel = start + level;
        }

      } else {
        maxAffordableLevel = level + levelGap;
        accumulatedPrice = getUpgradeTotalPriceAtLevel(upgradeData, maxAffordableLevel);
      }

      accumulatedPrice -= currentTotalPrice;

      // let alreadyMax = maxAffordableLevel == level + 1;
      // if (
      //   level > 0 
      //   && 
      //   showMaxPrice
      //   &&
      //   !alreadyMax
      // ) {
      //   accumulatedPrice -= stat.upgrade;
      //   maxAffordableLevel--;
      // }

      return {
        value: accumulatedPrice,
        nextLevel: maxAffordableLevel
      };
    }
}