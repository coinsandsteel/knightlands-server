import _ from "lodash";

import * as april from "../../knightlands-shared/april";
import errors from "../../knightlands-shared/errors";
import User from "../../user";

import { AprilMapState } from "./types";
import { AprilEvents } from "./AprilEvents";
import { AprilUser } from "./AprilUser";
import { AprilPlayground } from "./AprilPlayground";
import { AprilCroupier } from "./AprilCroupier";

export class AprilMap {
  protected _state: AprilMapState;
  protected _events: AprilEvents;
  protected _user: User;
  protected _aprilUser: AprilUser;
  protected _croupier: AprilCroupier;
  protected _playground: AprilPlayground;
  
  constructor(state: AprilMapState | null, events: AprilEvents, aprilUser: AprilUser, user: User) {
    this._events = events;
    this._user = user;
    this._aprilUser = aprilUser;

    this._playground = new AprilPlayground(state ? state.playground : null, this);
    this._croupier = new AprilCroupier(state ? state.croupier : null, this);

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }

  public setInitialState() {
    const playgroundState = this._playground.getState();
    const croupierState = this._croupier.getState();

    this._state = {
      heroClass: april.HERO_CLASS_KNIGHT,
      level: 1,
      sessionResult: null,
      hp: 0,
      actionPoints: 0,
      thirdActionPrice: 0,
      timesThirdActionPurchased: 0,
      playground: playgroundState,
      croupier: croupierState,
    } as AprilMapState;
  }

  public getState(): AprilMapState {
    return _.omit(this._state, ["timesThirdActionPurchased"]);
  }
  
  get events(): AprilEvents {
    return this._events;
  }

  get aprilUser(): AprilUser {
    return this._aprilUser;
  }

  public init() {
    this.wakeUp(this._state);
  }

  public restart(heroClass: string) {
    this._state.heroClass = heroClass;

    this._state.level = 1;
    this._events.level(1);

    this._state.hp = this.getInitialHp();
    this._events.hp(this._state.hp);

    this.startSession();
  }

  public startSession(booster?: string) {
    console.log("");
    console.log("");
    console.log("🚀🚀🚀 GAME STARTED 🚀🚀🚀", { 
      heroClass: this._state.heroClass
    });
    
    // ##### Stat #####
    this.handleBooster(booster);
    
    this._state.sessionResult = null;
    this._events.sessionResult(null);
    
    this._state.actionPoints = 2; // TODO verify this value
    this._events.actionPoints(this._state.actionPoints);

    // ##### Subsystems #####
    this._croupier.startSession();
    this._playground.startSession();
  }
  
  // TODO implement
  protected handleBooster(booster: string): void {
    // Verify class and level
    // Add hp or card
  }
  
  // TODO implement
  protected getInitialHp(): number {
    // TODO calc according to the balance table
    return 3;
  }

  public wakeUp(state: AprilMapState) {
    this._state.heroClass = state.heroClass;
    this._state.level = state.level;
    this._state.sessionResult = state.sessionResult;
    this._state.hp = state.hp;
    this._state.actionPoints = state.actionPoints;
    this._state.timesThirdActionPurchased = state.timesThirdActionPurchased;

    this._playground.wakeUp(state.playground);
    this._croupier.wakeUp(state.croupier);
  }

  public purchaseThirdAction() {
    if (this._state.actionPoints > 2) {
      throw errors.IncorrectArguments;
    }

    // TODO: Use correct formula to calculate price
    const price = (this._state.timesThirdActionPurchased + 1) * 100;
    if (this._aprilUser.gold < price) {
      throw errors.NotEnoughCurrency;
    }

    this._aprilUser.modifyBalance(april.CURRENCY_GOLD, -price);

    this._state.actionPoints++;
    this._state.timesThirdActionPurchased++;

    this._events.actionPoints(this._state.actionPoints);
  }

  public exit() {
    this._state.level = 1;
    this._events.level(1);
    
    this._state.sessionResult = null;
    this._events.sessionResult(null);
    
    this._state.hp = 3;
    this._events.hp(3);
    
    this._state.actionPoints = 2;
    this._events.actionPoints(2);

    this._croupier.exit();
    this._playground.exit();
  }
}