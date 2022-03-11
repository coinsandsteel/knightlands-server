import _ from "lodash";

import { AprilMapState } from "./types";
import User from "../../user";
import { AprilCroupier } from "./AprilCroupier";
import Game from "../../game";
import { AprilEvents } from "./AprilEvents";
import { AprilUser } from "./AprilUser";
import { AprilHit } from "./AprilHit";

export class AprilMap {
  private _state: AprilMapState;
  private _events: AprilEvents;
  private _user: User;
  private _aprilUser: AprilUser;
  private _aprilCroupier: AprilCroupier;
  private _aprilHit: AprilHit;


  constructor(state: AprilMapState | null, events: AprilEvents, aprilUser: AprilUser, user: User) {
    this._events = events;
    this._user = user;
    this._aprilUser = aprilUser;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }

    this._aprilHit = new AprilHit(this);
    this._aprilCroupier = new AprilCroupier(this);
  }

  public setInitialState() {
    this._state = {
      cards: []
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
}