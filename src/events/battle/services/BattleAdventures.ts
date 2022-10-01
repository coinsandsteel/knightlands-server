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

  get difficulty(): string {
    return this._state.difficulty;
  }

  protected setInitialState() {
    const locations = _.cloneDeep(LOCATIONS).map((location) =>
      location.levels.map(() => {
        return {
          [GAME_DIFFICULTY_MEDIUM]: false,
          [GAME_DIFFICULTY_HIGH]: false
        };
      })
    );
    this._state = {
      difficulty: GAME_DIFFICULTY_MEDIUM,
      locations,
    } as BattleAdventuresState;
  }

  public setDifficulty(difficulty: string): void {
    this._state.difficulty = difficulty;
    this._core.events.adventures(this._state);
  }

  public setLevelPassed(location: number, level: number): void {
    this._state.locations[location][level][this._state.difficulty] = true;
    this._core.events.adventures(this._state);
  }

  protected prevLocationsPassed(location: number): boolean {
    if (!location) {
      return true;
    }
    const previousLocations = this._state.locations.slice(0, location - 1);
    const allPrevLocationsPassed = previousLocations.every((location) =>
      location.every((level) => level[this.difficulty])
    );
    return allPrevLocationsPassed;
  }

  protected prevLevelsPassed(location: number, level: number): boolean {
    if (!level) {
      return true;
    }
    const previousLevels = this._state.locations[location].slice(0, level - 1);
    const allPrevLevelsPassed = previousLevels.every(
      (level) => level[this.difficulty]
    );
    return allPrevLevelsPassed;
  }

  public canEnterLevel(location: number, level: number): boolean {
    return this.prevLocationsPassed(location) && this.prevLevelsPassed(location, level);
  }

  public getState(): BattleAdventuresState {
    return this._state;
  }
}
