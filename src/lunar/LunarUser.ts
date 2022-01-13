import _ from "lodash";
import User from "../user";
import { LunarEvents } from "./LunarEvent";
import { LunarState } from "./types";


export class LunarUser {
  private _state: LunarState;
  private _events: LunarEvents;
  private _user: User;

  constructor(state: LunarState | null, events: LunarEvents, user: User) {
      this._events = events;
      this._user = user;

      if (state) {
        this._state = state;
        this.wakeUp();
      } else {
        this.setInitialState();
      }
  }

  public async init() {
  }

  public getState(): LunarState {
    return this._state;
  }

  public setInitialState() {
    const state: LunarState = {
      rebalance: {
        price: 0,
        counter: 1
      },
      levelGap: 1,
      tower: {
        level: 1,
        percentage: 0,
        exp: 0,
        currentLevelExp: 0,
        nextLevelExp: 0
      },
      // slots,
      // burstPerks,
      // perks,
      // balance,
      // cpoints: {
      //   lastClaimed: 0,
      //   pointsPool: 0,
      //   shares: 0,
      //   sharesPool: 0,
      //   score: 0
      // }
    };
    this._state = _.cloneDeep(state);
    this.recalculateStats(false);
  }

  wakeUp() {
    // for (let tier = 1; tier <= 9; tier++) {
    //   let tierData = this._state.slots[tier];
    //   if (!tierData.launched) {
    //     continue;
    //   }
      
    //   let accumulated = this.getAccumulatedProgressive(tier);
    //   this._state.slots[tier].accumulated.currency = accumulated.currency;
    //   this._state.slots[tier].accumulated.exp = accumulated.exp;
    //   this._state.slots[tier].launched = accumulated.launched;
    //   this._state.slots[tier].progress.autoCyclesLeft = accumulated.autoCyclesLeft;
    //   this._state.slots[tier].progress.autoCyclesSpent = accumulated.autoCyclesSpent;
    //   this._state.slots[tier].progress.percentage = accumulated.percentage;

    //   if (this._state.slots[tier].launched) {
    //     this.launchTimer(tier, false);
    //   }
    // }
  }


  shutdown() {
    // this.removeTimers();
    // this.disableActivePerks();
    this.recalculateStats(false);
  }

  recalculateStats(sendEvents){
    // for (let tier = 1; tier <= 9; tier++) {
    //   this.reCalculateTierStats(tier, sendEvents);
    // }
    // this.reCalculatePerkPrices(sendEvents);
  }
}