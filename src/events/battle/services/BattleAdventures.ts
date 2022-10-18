import _ from "lodash";
import {
  GAME_DIFFICULTY_HIGH,
  GAME_DIFFICULTY_MEDIUM,
  ADVENTURES,
  ADVENTURE_ENEGRY_PRICE,
  CURRENCY_COINS,
  CURRENCY_CRYSTALS,
} from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import {
  BattleAdventureLevelData,
  BattleAdventureLevelDifficultyMeta,
  BattleAdventureLevelMeta,
  BattleAdventureLocationData,
  BattleAdventureLocationMeta,
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

  get levelDifficultyMeta(): BattleAdventureLevelDifficultyMeta | null {
    if (this.location !== null && this.level !== null) {
      return _.cloneDeep(
        ADVENTURES[this.location].levels[this.level][this.difficulty]
      );
    }
    return null;
  }

  constructor(state: BattleAdventuresState, core: BattleCore) {
    super();
    this._core = core;
    this._locationsCount = ADVENTURES.length;
    this._levelsCount = ADVENTURES[0].levels.length;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }

  protected setInitialState() {
    const locations = _.cloneDeep(
      ADVENTURES as BattleAdventureLocationMeta[]
    ).map((location) => {
      return {
        levels: location.levels.map(
          (level: BattleAdventureLevelMeta, index) => {
            const levelData = {
              [GAME_DIFFICULTY_MEDIUM]: false,
              [GAME_DIFFICULTY_HIGH]: false,
            } as BattleAdventureLevelData;

            if (level[GAME_DIFFICULTY_MEDIUM].bossReward.coins) {
              levelData.bossRewardClaimed = false;
            }

            return levelData;
          }
        ),
      };
    }) as BattleAdventureLocationData[];

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
    const levelMeta = this.levelDifficultyMeta;
    if (!levelMeta) {
      throw new Error("Cannot get enemy squad. Level or location is null");
    }
    if (
      levelMeta.bossReward &&
      (levelMeta.bossReward.coins || levelMeta.bossReward.crystals)
    ) {
      this._state.locations[this.location].levels[
        this.level
      ].bossRewardClaimed = true;
    }

    let location = this.location;
    let level = this.level;

    // Go to the next level
    level++;

    // Last level? Go to the next location
    if (
      this.difficulty === GAME_DIFFICULTY_MEDIUM
      &&
      level > this._levelsCount - 1
    ) {
      level = 0;
      location++;

      // Open high difficulty in the current location
      this._state.locations[this.location].levels[0][GAME_DIFFICULTY_HIGH] = true;
    }

    // Open the next level
    if (
      // Do not open next location in the last location
      this.location <= this._locationsCount - 1
      &&
      // Do not unlock next high location
      (
        (
          this.difficulty === GAME_DIFFICULTY_HIGH
          &&
          level <= this._levelsCount - 1
        )
        ||
        // Unlock next medium location
        this.difficulty === GAME_DIFFICULTY_MEDIUM
      )
    ) {
      this._state.locations[location].levels[level][this.difficulty] = true;
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

  public getLevelData(
    location: number,
    level: number
  ): BattleAdventureLevelData {
    return this._state.locations[location].levels[level];
  }

  public getCurrentLevelReward(): BattleCombatRewards {
    const levelMeta = this.levelDifficultyMeta;
    if (!levelMeta) {
      throw new Error("Cannot get enemy squad. Level or location is null");
    }

    const levelData = this.getLevelData(this.location, this.level);
    return {
      coins:
        levelMeta.reward.coins +
        (levelMeta.bossReward && !levelData.bossRewardClaimed
          ? levelMeta.bossReward.coins
          : 0),
      crystals:
        levelMeta.bossReward && !levelData.bossRewardClaimed
          ? levelMeta.bossReward.crystals
          : 0,
      xp: levelMeta.reward.xp,
      rank: 0,
    };
  }

  public getMap(location: number, level: number): BattleTerrainMap {
    return TERRAIN[location * 5 + level];
  }

  public getEnemySquad(location: number, level: number): BattleFighter[] {
    const levelMeta = this.levelDifficultyMeta;
    if (!levelMeta) {
      throw new Error("Cannot get enemy squad. Level or location is null");
    }

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
