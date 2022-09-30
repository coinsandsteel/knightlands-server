import _ from "lodash";
import {
  GAME_DIFFICULTY_HIGH,
  GAME_DIFFICULTY_MEDIUM,
  LOCATIONS,
} from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import { BattleAdventuresState } from "../types";
import { BattleService } from "./BattleService";

export class BattleAdventures extends BattleService {
  protected _core: BattleCore;
  protected _state: BattleAdventuresState;

  constructor(state: BattleAdventuresState, core: BattleCore) {
    super();
    this._core = core;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }

  protected setInitialState() {
    const locations = _.cloneDeep(LOCATIONS).map((location) =>
      location.levels.map(() => {
        return {
          [GAME_DIFFICULTY_MEDIUM]: false,
          [GAME_DIFFICULTY_HIGH]: false,
        };
      })
    );
    locations[0][0][GAME_DIFFICULTY_MEDIUM] = true;

    this._state = {
      difficulty: GAME_DIFFICULTY_MEDIUM,
      locations,
    } as BattleAdventuresState;
  }

  public getState(): BattleAdventuresState {
    return this._state;
  }
}
