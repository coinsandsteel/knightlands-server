import _ from "lodash";
import {
  GAME_DIFFICULTY_HIGH,
  GAME_DIFFICULTY_MEDIUM,
  ADVENTURES,
  ADVENTURE_ENEGRY_PRICE,
  CURRENCY_COINS,
} from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import {
  BattleAdventureLevel,
  BattleAdventuresState,
  BattleCombatRewards,
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

  get energyPrice(): number {
    return ADVENTURE_ENEGRY_PRICE[this.difficulty];
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
      this._state.locations[location].levels[level][GAME_DIFFICULTY_MEDIUM] =
        true;

      // Open first high level if the last medium was done
      if (this.level === this._levelsCount - 1) {
        this._state.locations[this.location].levels[0][GAME_DIFFICULTY_HIGH] =
          true;
      }
    } else if (this.difficulty === GAME_DIFFICULTY_HIGH) {
      // Find the next level
      level++;
      if (level > this._levelsCount - 1) {
        return;
      }

      // Open the next level
      this._state.locations[location].levels[level][GAME_DIFFICULTY_HIGH] =
        true;
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
    return _.cloneDeep(ADVENTURES[location].levels[level][this.difficulty]);
  }

  public getCurrentLevelReward(): BattleCombatRewards {
    const levelMeta = this.getLevelMeta(this.location, this.level);
    return {
      coins: levelMeta.reward.coins + levelMeta.bossReward.coins,
      crystals: levelMeta.bossReward.crystals,
      xp: levelMeta.reward.xp,
      rank: 0
    };
  }

  public getMap(location: number, level: number): BattleTerrainMap {
    return TERRAIN[location * 5 + level];
  }

  public getEnemySquad(location: number, level: number): BattleFighter[] {
    const levelMeta = this.getLevelMeta(location, level);
    const enemySquad = levelMeta.enemies.templates.map((template) => {
      const unitMeta = game.battleManager.getUnitMeta(template);
      const unit = Unit.createUnit(
        { ...unitMeta, _id: template },
        this._core.events
      );

      // Level
      unit.setLevel(levelMeta.enemies.level);

      // Abilities level
      unit.setAbilitiesLevels([
        { tier: 1, level: levelMeta.enemies.abilities[0] },
        { tier: 2, level: levelMeta.enemies.abilities[1] },
        { tier: 3, level: levelMeta.enemies.abilities[2] },
      ]);

      // Boss
      const isBoss = levelMeta.enemies.boss === template;
      if (isBoss) {
        unit.turnIntoBoss();
      }

      const fighter = Fighter.createFighter(unit, true, this._core.events);
      return fighter.serializeFighter();
    });
    return enemySquad;
  }

  protected locationPassed(location: number, difficulty: string): boolean {
    const currentLocation = this._state.locations[location];
    const locationPassed = currentLocation.levels.every(
      (level) => level[difficulty]
    );
    return locationPassed;
  }

  public canEnterLevel(location: number, level: number): boolean {
    return (
      this._core.user.energy >= this.energyPrice &&
      this._state.locations[location].levels[level][this.difficulty]
    );
  }

  public getState(): BattleAdventuresState {
    return this._state;
  }
}
