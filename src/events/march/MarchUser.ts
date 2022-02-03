import _ from "lodash";
import User from "../../user";
import Game from "../../game";
import Errors from "../../knightlands-shared/errors";
import { MarchState } from "./types";
import { MarchEvents } from "./MarchEvents";

export class MarchUser {
    private _state: MarchState;
    private _events: MarchEvents;
    private _user: User;

    constructor(state: MarchState | null, events: MarchEvents, user: User) {
        this._events = events;
        this._user = user;

        if (state) {
          this._state = state;
        } else {
          this.setInitialState();
        }
    }
  
    public async init() {}

    public setInitialState() {
      const state: MarchState = {};
      this._state = _.cloneDeep(state);
    }
}