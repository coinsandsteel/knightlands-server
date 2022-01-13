import _ from "lodash";
import { LunarEvents } from "./LunarEvents";
import { LunarState } from "./types";
import User from "../user";

const bounds = require("binary-search-bounds");

export class LunarUser {
    private _state: LunarState;
    private _events: LunarEvents;
    private _user: User;

    constructor(state: LunarState | null, events: LunarEvents, user: User) {
        this._events = events;
        this._user = user;

        if (state) {
          this._state = state;
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

      };
      this._state = _.cloneDeep(state);
    }
}