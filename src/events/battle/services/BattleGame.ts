import _ from "lodash";
import { BattleController } from "../BattleController";
import { SQUAD_BONUSES } from "../meta";
import { BattleGameState } from "../types";
import { Unit } from "../units/Unit";
import { BattleSquad } from "./BattleSquad";

export class BattleGame {
  protected _state: BattleGameState;
  protected _ctrl: BattleController;

  protected _userSquad: BattleSquad;
  protected _enemySquad: BattleSquad;

  constructor(state: BattleGameState|null, ctrl: BattleController) {
    this._state = state;
    this._ctrl = ctrl;

    this._userSquad = new BattleSquad(state ? state.userSquad : null, this._ctrl);
    this._enemySquad = new BattleSquad(state ? state.enemySquad : null, this._ctrl);

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }

  get combatStarted(): boolean {
    return this._state.combat.started;
  }

  // TODO
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
  
  // TODO
  public apply(unitId: string, index: number, ability?: string): void {
    
  }
  
  public skip(): void {}

  public exit(): void {}
}