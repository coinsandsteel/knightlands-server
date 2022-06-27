import _ from "lodash";
import { GAME_DIFFICULTY_HIGH, GAME_DIFFICULTY_LOW, GAME_DIFFICULTY_MEDIUM, GAME_MODE_DUEL } from "../../../knightlands-shared/battle";
import { BattleController } from "../BattleController";
import { SQUAD_BONUSES, TERRAIN } from "../meta";
import { BattleGameState } from "../types";
import { BattleSquad } from "./BattleSquad";

export class BattleGame {
  protected _state: BattleGameState;
  protected _ctrl: BattleController;

  protected _userSquad: BattleSquad;
  protected _enemySquad: BattleSquad;
  protected _enemyOptions: any[][];
  protected _initiativeRating: any[];

  constructor(state: BattleGameState|null, ctrl: BattleController) {
    this._ctrl = ctrl;

    this._userSquad = new BattleSquad(
      state ? state.userSquad.units : null, 
      this._ctrl
    );
    this._enemySquad = new BattleSquad(
      state ? state.enemySquad.units : null, 
      this._ctrl
    );

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }

  get combatStarted(): boolean {
    return this._state.combat.started;
  }

  protected setInitialState() {
    this._state = {
      mode: null,
      room: null, // 8
      difficulty: null, // "low", "mudium", "hard"
      level: 0, // 5 + 1

      userSquad: this._userSquad.getState(),
      enemySquad: this._enemySquad.getState(),
      terrain: [],

      combat: {
        started: false,
        result: null, // "win" | "loose"
        isMyTurn: null,
        activeUnitId: null,
        runtime: {
          unitId: null,
          selectedIndex: null,
          selectedAbilityClass: null,
          moveCells: [],
          attackCells: []
        }
      }
    } as BattleGameState;
  }

  public getState(): BattleGameState {
    this._state.userSquad = this._userSquad.getState();
    this._state.enemySquad = this._enemySquad.getState();
    return this._state;
  }

  public init(): void {
    this._userSquad.init();
    this._enemySquad.init();
  }
  
  public squadIncludesUnit(unitId: string): boolean {
    return this._userSquad.includesUnit(unitId);
  }
  
  public proxyUnit(unitId: string): void {
    this._userSquad.proxyUnit(unitId);
  }
  
  public fillSquadSlot(unitId: string, index: number): void {
    this._userSquad.fillSlot(unitId, index);
  }
  
  public clearSquadSlot(index: number): void {
    this._userSquad.clearSlot(index);
  }

  public buildSquad(): void {
    const tribe = _.sample(_.cloneDeep(Object.keys(SQUAD_BONUSES)));
    const tier = _.random(1, 3);

    console.log("Build squad", { tribe, tier });

    for (let index = 0; index < 5; index++) {
      const unit = this._ctrl.inventory.getRandomUnitByProps(tribe, tier);
      console.log("Squad member", { unitId: unit.unitId, tribe: unit.tribe, unitClass: unit.class, tier: unit.tier });
      
      const existingUnit = this._ctrl.inventory.getUnitByTemplateAndTier(unit.template, tier);
      console.log("Existing member", { 
        existingUnit
      });
      
      if (!existingUnit) {
        this._ctrl.inventory.addUnit(unit);
      }
      
      this._userSquad.fillSlot(existingUnit ? existingUnit.unitId : unit.unitId, index);
    }
  }

  public clearSquad(): void {
    for (let index = 0; index < 5; index++) {
      this._userSquad.clearSlot(index);
    }
  }

  // TODO
  public enterLevel(room: number, level: number): void {
    // Set room/level
    // Set difficulty
    // Set isMyTurn
    // Find an enemy
    // Load terrain
  }
  
  public enterDuel(difficulty: string): void {
    // Set game mode and difficulty
    this.setMode(GAME_MODE_DUEL);
    this.setDifficulty(difficulty);
    
    // Set enemy squad
    const difficulties = {
      [GAME_DIFFICULTY_HIGH]: 0,
      [GAME_DIFFICULTY_MEDIUM]: 1,
      [GAME_DIFFICULTY_LOW]: 2
    };
    const squad = this._enemyOptions[difficulties[difficulty]];
    this._enemySquad = new BattleSquad(squad, this._ctrl);
    this._enemyOptions = [[], [], []];

    // Prepare user Squad
    this._userSquad.setInitialIndexes(false);
    this._state.userSquad = this._enemySquad.getState();
    this._ctrl.events.userSquad(this._state.userSquad);
    
    // Prepare enemy squad
    this._enemySquad.setInitialIndexes(true);
    this._state.enemySquad = this._enemySquad.getState();
    this._ctrl.events.enemySquad(this._state.enemySquad);
    
    // Terrain
    this._state.terrain = TERRAIN[0];
    this._ctrl.events.terrain(this._state.terrain);

    // Start combat
    this.setCombatStarted(true);
    this.setActiveUnitId();
  }
  
  public getDuelOptions() {
    const tribe = _.sample(_.cloneDeep(Object.keys(SQUAD_BONUSES)));
    const squads = [[], [], []];
    
    for (let tier = 1; tier <= 3; tier++) {
      for (let index = 0; index < 5; index++) {
        const unit = this._ctrl.inventory.getRandomUnitByProps(tribe, tier);
        squads[tier-1].push(unit.serializeForSquad());
      }
    }
    
    this._enemyOptions = squads;

    return squads;
  }
  
  public setMode(mode: string): void {
    this._state.mode = mode;
    this._ctrl.events.mode(mode);
  }
  
  public setDifficulty(difficulty: string): void {
    this._state.difficulty = difficulty;
    this._ctrl.events.difficulty(difficulty);
  }
  
  public setCombatStarted(value: boolean): void {
    this._state.combat.started = value;
    this._ctrl.events.combatStarted(value);
  }
  
  public setActiveUnitId(): void {
    this._initiativeRating = _.orderBy(
      _.union(
        this._userSquad.getState().units,
        //this._enemySquad.getState().units
      ).map(unit => {
        return { unitId: unit.unitId, initiative: unit.initiative };
      }),
      ["initiative", "desc"]
    );

    const unitId = this._initiativeRating[0].unitId;
    this._state.combat.activeUnitId = unitId;
    this._ctrl.events.activeUnitId(unitId);
  }
  
  public unitChoose(unitId: string): void {
    const attackCells = [...Array(5)].map(e=> _.random(0, 34));
    const moveCells = [...Array(5)].map(e=> _.random(0, 34));
    this._ctrl.events.combatAttackCells(attackCells);
    this._ctrl.events.combatMoveCells(moveCells);
  }
  
  // TODO
  public apply(unitId: string, index: number, ability?: string): void {
    
  }
  
  public skip(): void {}

  public exit(): void {}
}