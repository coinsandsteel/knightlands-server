import _ from "lodash";
import {
  ADVENTURES,
  GAME_DIFFICULTY_HIGH,
  GAME_DIFFICULTY_MEDIUM,
  LOCATIONS,
} from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import {
  BattleAdventureLevel,
  BattleAdventuresState,
  BattleFighter,
  BattleTerrainMap,
} from "../types";
import { BattleService } from "./BattleService";
import { TERRAIN } from "../meta";
import game from "../../../game";
import { Unit } from "../units/Unit";
import { Fighter } from "../units/Fighter";

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

  public setDifficulty(difficulty: string): void {
    this._state.difficulty = difficulty;
    this._core.events.adventures(this._state);
  }

  public setLevelPassed(location: number, level: number): void {
    this._state.locations[location][level][this._state.difficulty] = true;
    this._core.events.adventures(this._state);
  }

  public getLevelMeta(location: number, level: number): BattleAdventureLevel {
    return ADVENTURES[this._state.difficulty][location][level];
  }

  public getMap(location: number, level: number): BattleTerrainMap {
    return TERRAIN[location * 5 + level];
  }

  public getEnemySquad(location: number, level: number): BattleFighter[] {
    const levelMeta = _.cloneDeep(this.getLevelMeta(location, level));
    const enemySquad = levelMeta.enemies.templates.map((template) => {
      const unitMeta = game.battleManager.getUnitMeta(template);
      const unit = Unit.createUnit(
        { ...unitMeta, _id: template },
        this._core.events
      );
      const fighter = Fighter.createFighter(unit, true, this._core.events);
      return fighter.serializeFighter();
    });
    return enemySquad;
  }

  protected locationPassed(location: number, difficulty: string): boolean {
    if (!location) {
      return true;
    }
    const currentLocation = this._state.locations[location];
    const allLocationsPassed = currentLocation.every(
      (level) => level[difficulty]
    );
    return allLocationsPassed;
  }

  protected prevLocationsPassed(location: number, difficulty: string): boolean {
    if (!location) {
      return true;
    }
    const previousLocations = this._state.locations.slice(0, location - 1);
    const allPrevLocationsPassed = previousLocations.every((location) =>
      location.every((level) => level[difficulty])
    );
    return allPrevLocationsPassed;
  }

  protected prevLevelsPassed(
    location: number,
    level: number,
    difficulty: string
  ): boolean {
    if (!level) {
      return true;
    }
    const previousLevels = this._state.locations[location].slice(0, level - 1);
    const allPrevLevelsPassed = previousLevels.every(
      (level) => level[difficulty]
    );
    return allPrevLevelsPassed;
  }

  public canEnterLevel(
    location: number,
    level: number,
    difficulty: string
  ): boolean {
    if (difficulty === GAME_DIFFICULTY_MEDIUM) {
      return (
        this.prevLocationsPassed(location, difficulty) &&
        this.prevLevelsPassed(location, level, difficulty)
      );
    } else if (difficulty === GAME_DIFFICULTY_HIGH) {
      return (
        this.locationPassed(location, GAME_DIFFICULTY_MEDIUM) &&
        this.prevLevelsPassed(location, level, difficulty)
      );
    } else {
      return false;
    }
  }

  public getState(): BattleAdventuresState {
    return this._state;
  }
}
