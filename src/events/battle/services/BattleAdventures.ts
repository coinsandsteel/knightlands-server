import _ from "lodash";
import {
  GAME_DIFFICULTY_HIGH,
  GAME_DIFFICULTY_MEDIUM,
  ADVENTURES,
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
  protected _locationsCount: number = 0;
  protected _levelsCount: number = 0;
  protected _core: BattleCore;
  protected _state: BattleAdventuresState;

  get difficulty(): string {
    return this._state.difficulty;
  }

  get location(): number | null {
    return this._state.location;
  }

  get level(): number | null {
    return this._state.level;
  }

  constructor(state: BattleAdventuresState, core: BattleCore) {
    super();
    this._core = core;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }

    this._locationsCount = ADVENTURES.length;
    this._levelsCount = ADVENTURES[0].levels.length;
  }

  protected setInitialState() {
    const locations = _.cloneDeep(ADVENTURES).map((location) => {
      return {
        levels: location.levels.map(() => {
          return {
            [GAME_DIFFICULTY_MEDIUM]: false,
            [GAME_DIFFICULTY_HIGH]: false,
          };
        }),
      };
    });

    // Open the very first level
    locations[0].levels[0][GAME_DIFFICULTY_MEDIUM] = true;

    this._state = {
      difficulty: GAME_DIFFICULTY_MEDIUM,
      location: null,
      level: null,
      locations,
    } as BattleAdventuresState;
  }

  public handleLevelPassed(): void {
    let location = this.location;
    let level = this.level;

    if (this.difficulty === GAME_DIFFICULTY_MEDIUM) {
      // Find the next level
      level++;
      if (level > this._levelsCount - 1) {
        level = 0;
        location++;
      }

      // Open the next level
      this._state.locations[location].levels[level][GAME_DIFFICULTY_MEDIUM] = true;

      // Open prev location high level if current medium location is done
      if (this.locationPassed(location, GAME_DIFFICULTY_MEDIUM)) {
        this._state.locations[location].levels[0][GAME_DIFFICULTY_HIGH] = true;
      }
    } else if (this.difficulty === GAME_DIFFICULTY_HIGH) {
      // Find the next level
      level++;
      if (level > this._levelsCount - 1) {
        return;
      }

      // Open the next level
      this._state.locations[location].levels[level][GAME_DIFFICULTY_HIGH] = true;
    }

    this._core.events.adventures(this._state);
  }

  public setDifficulty(difficulty: string): void {
    this._state.difficulty = difficulty;
    this._core.events.adventures(this._state);
  }

  public setLevel(location: number | null, level: number | null): void {
    this._state.location = location;
    this._state.level = level;
    this._core.events.adventures(this._state);
  }

  public getLevelMeta(location: number, level: number): BattleAdventureLevel {
    return ADVENTURES[location].levels[level][this.difficulty];
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
    const currentLocation = this._state.locations[location];
    const locationPassed = currentLocation.levels.every((level) => level[difficulty]);
    return locationPassed;
  }

  public canEnterLevel(location: number, level: number): boolean {
    return this._state.locations[location].levels[level][this.difficulty];
  }

  public getState(): BattleAdventuresState {
    return this._state;
  }
}
