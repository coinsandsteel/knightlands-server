import _ from "lodash";
import User from "../../user";
import Game from "../../game";
import Errors from "../../knightlands-shared/errors";
import { MarchUserState } from "./types";
import { MarchEvents } from "./MarchEvents";
import { MarchMap } from "./MarchMap";

export class MarchUser {
    private _state: MarchUserState;
    private _events: MarchEvents;
    private _user: User;

    constructor(state: MarchUserState | null, events: MarchEvents, user: User) {
        this._events = events;
        this._user = user;

        if (state) {
          this._state = state;
        } else {
          this.setInitialState();
        }
    }
      
    public setInitialState() {
      this._state = {
        balance: {
          tickets: 0,
          gold: 0
        },
        boosters: {
          maxHealth: 0,
          extraLife: 0,
          key: 0,
        }
      } as MarchUserState;
    }
    
    public getState(): MarchUserState {
      return this._state;
    }
    
    public async init() {
    }
}