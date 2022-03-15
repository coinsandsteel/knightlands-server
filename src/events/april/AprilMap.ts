import _ from "lodash";

import { AprilMapState } from "./types";
import User from "../../user";
import { AprilCroupier } from "./AprilCroupier";
import { AprilEvents } from "./AprilEvents";
import { AprilUser } from "./AprilUser";
import { AprilDamage } from "./AprilDamage";
import errors from "../../knightlands-shared/errors";
import * as april from "../../knightlands-shared/april";

export class AprilMap {
  private _state: AprilMapState;
  private _events: AprilEvents;
  private _user: User;
  private _aprilUser: AprilUser;
  private _aprilCroupier: AprilCroupier;
  private _aprilDamage: AprilDamage;

  constructor(state: AprilMapState | null, events: AprilEvents, aprilUser: AprilUser, user: User) {
    this._events = events;
    this._user = user;
    this._aprilUser = aprilUser;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }

    this._aprilDamage = new AprilDamage(this);
    this._aprilCroupier = new AprilCroupier(this);
  }

  public setInitialState() {
    this._state = {
      hp: 0,
      actionPoints: 0,
      cardsInQueue: 0,
      units: [],
      damage: [],
      cards: [],
      usedCards: [],
      timesThirdActionPurchased: 0,
      canBuyThirdAction: false
    } as AprilMapState;
  }

  get events(): AprilEvents {
    return this._events;
  }

  get aprilUser(): AprilUser {
    return this._aprilUser;
  }

  get croupier(): AprilCroupier {
    return this._aprilCroupier;
  }

  public init() {
    this.wakeUp(this._state);
  }

  public wakeUp(state: AprilMapState) {
    // Parse stat
    // this.parseStat(state.stat);
    // // Set cards
    // this.parseCards(state.cards);
    // // Set pet attributes
    // this.parsePet(state.pet);
  }

  public getState(): AprilMapState {
    return this._state;
  }

  public purchaseThirdAction() {
    if (this._state.actionPoints === 3 || !this._state.canBuyThirdAction) {
      throw errors.IncorrectArguments;
    }

    // TODO: Use correct formula to calculate price
    const price = (this._state.timesThirdActionPurchased + 1) * 100;
    if (this._aprilUser.gold < price) {
      throw errors.NotEnoughCurrency;
    }

    this._aprilUser.modifyBalance(april.CURRENCY_GOLD, -price);
    this._state.canBuyThirdAction = false;
    this._state.actionPoints++;
    this._state.timesThirdActionPurchased++;
    this._events.actionPoints(this._state.actionPoints);
  }
}