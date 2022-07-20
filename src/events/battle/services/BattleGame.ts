import _ from "lodash";
import { ABILITY_TYPE_ATTACK, ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF, ABILITY_TYPE_HEALING, ABILITY_TYPE_JUMP, ABILITY_TYPE_SELF_BUFF, ABILITY_TYPES, GAME_DIFFICULTY_HIGH, GAME_DIFFICULTY_LOW, GAME_DIFFICULTY_MEDIUM, GAME_MODE_DUEL, ABILITY_GROUP_HEAL, ABILITY_ATTACK, UNIT_CLASS_MELEE, UNIT_CLASS_RANGE, UNIT_CLASS_MAGE, UNIT_CLASS_TANK, UNIT_CLASS_SUPPORT, UNIT_TRIBE_KOBOLD, ABILITY_MOVE } from "../../../knightlands-shared/battle";
import { BattleController } from "../BattleController";
import { SETTINGS, SQUAD_BONUSES, TERRAIN } from "../meta";
import { BattleGameState, BattleInitiativeRatingEntry } from "../types";
import { Unit } from "../units/Unit";
import { BattleCombat } from "./BattleCombat";
import { BattleMovement } from "./BattleMovement";
import { BattleSquad } from "./BattleSquad";
import { BattleTerrain } from "./BattleTerrain";

export class BattleGame {
  protected _state: BattleGameState;
  protected _ctrl: BattleController;
  
  protected _userSquad: BattleSquad;
  protected _enemySquad: BattleSquad;
  protected _enemyOptions: any[][];

  protected _combat: BattleCombat;
  protected _movement: BattleMovement;
  protected _terrain: BattleTerrain;
  protected _aiMoveTimeout: ReturnType<typeof setTimeout>;
 
  constructor(state: BattleGameState|null, ctrl: BattleController) {
    this._ctrl = ctrl;

    this._userSquad = new BattleSquad(
      state ? state.userSquad.units : [],
      false,
      this._ctrl
    );
    this._enemySquad = new BattleSquad(
      state ? state.enemySquad.units : [], 
      true,
      this._ctrl
    );

    if (state) {
      this._state = state;
      console.log("[Game] Loaded initiative rating", this._state.initiativeRating);
    } else {
      this.setInitialState();
    }

    this._movement = new BattleMovement(this._ctrl);
    this._combat = new BattleCombat(this._ctrl);
    this._terrain = new BattleTerrain(this._state.terrain, this._ctrl);

    console.log("[Game] Loaded");
  }

  get relativeEnemySquad(): Unit[] {
    const activeFighter = this.getActiveFighter();
    return activeFighter.isEnemy ? this._userSquad.units : this._enemySquad.units;
  }

  get movement(): BattleMovement {
    return this._movement;
  }

  get terrain(): BattleTerrain {
    return this._terrain;
  }

  get combatStarted(): boolean {
    return this._state.combat.started;
  }

  get allUnits(): Unit[] {
    return [...this._userSquad.units, ...this._enemySquad.units];
  }

  async dispose() {
    console.log("[Game] Shutting down", this._state);
  }
  
  protected setInitialState() {
    this._state = {
      mode: null,
      room: null, // 8
      difficulty: null, // "low", "mudium", "hard"
      level: 0, // 5 + 1

      userSquad: this._userSquad.getState(),
      enemySquad: this._enemySquad.getState(),
      initiativeRating: [],
      terrain: null,

      combat: {
        started: false,
        result: null, // "win" | "loose"
        isMyTurn: null,
        activeFighterId: null,
        runtime: {
          selectedIndex: null,
          selectedAbilityClass: null,
          moveCells: [],
          attackCells: []
        }
      }
    } as BattleGameState;

    console.log("[Game] Initial state was set");
  }

  public getState(): BattleGameState {
    this._state.userSquad = this._userSquad.getState();
    this._state.enemySquad = this._enemySquad.getState();
    this._state.terrain = this._terrain.getState();
    return this._state;
  }

  public init(): void {
    console.log("[Game] Init", this._state);
    
    this._userSquad.init();
    this._enemySquad.init();

    if (this._state.combat.started) {
      console.log("[Game] Resuming combat", this._state);
      this.launchFighter();
    }

    /*[
      UNIT_CLASS_MELEE, 
      UNIT_CLASS_RANGE, 
      UNIT_CLASS_MAGE, 
      UNIT_CLASS_TANK, 
      UNIT_CLASS_SUPPORT
    ].forEach(unitClass => {
      let level = 1;
      while (level <= 45) {
        const c = Unit.getCharacteristics(unitClass, level);
        console.log(`[${unitClass}] level: ${level}, hp: ${c.hp}, damage: ${c.damage}, defence: ${c.defence}, speed: ${c.speed}, initiative: ${c.initiative}`);
        level++;
      }
    })*/
  }
  
  protected getActiveFighter(): Unit|null {
    const fighterId = this._state.combat.activeFighterId;
    return this._userSquad.getFighter(fighterId) || this._enemySquad.getFighter(fighterId) || null;
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
    if (!this._userSquad.units.length) {
      return;
    }

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
    this._enemySquad = new BattleSquad(squad, true, this._ctrl);
    this._enemyOptions = [[], [], []];

    // Prepare user Squad
    this._userSquad.setInitialIndexes(false);
    this._state.userSquad = this._userSquad.getState();
    this._ctrl.events.userSquad(this._state.userSquad);
    
    // Prepare enemy squad
    this._enemySquad.setInitialIndexes(true);
    this._enemySquad.regenerateFighterIds();
    this._state.enemySquad = this._enemySquad.getState();
    this._ctrl.events.enemySquad(this._state.enemySquad);
    
    // Terrain
    this._terrain.setRandomMap();

    // Start combat
    this.setCombatStarted(true);
    this.createInitiativeRating();
    this.nextFighter();
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
  
  public setCombatResult(value: string|null): void {
    this._state.combat.result = value;
    this._ctrl.events.combatResult(value);
  }
  
  public nextFighter(): void {
    if (!this._state.initiativeRating || !this._state.initiativeRating.length) {
      throw Error("No initiative rating. Cannot choose next fighter.");
    }

    console.log("[Game] Choosing the next fighter...");
    
    // No active fighter
    if (!this.getActiveFighter()) {
      console.log("[Game] No active fighter. Choosing the first one.");
      this.setActiveFighter(null);
    // Next fighter
    } else {
      const nextFighterId = this.getNextFighterId();
      console.log(`[Game] Now active fighter is ${nextFighterId}`);
      this.setActiveFighter(nextFighterId);
    }

    this.launchFighter();
  }
  
  public launchFighter(): void {
    const activeFighter = this.getActiveFighter();
    if (activeFighter.isEnemy) {
      console.log(`[Game] Active fighter is ${this._state.combat.activeFighterId} (enemy). Making a move...`);
      this.setMoveCells([]);
      this.autoMove(activeFighter);
    } else {
      console.log(`[Game] Active fighter is ${this._state.combat.activeFighterId} (user's). Showing move cells.`);
      const moveCells = this._movement.getRangeCells("move", activeFighter.index, activeFighter.speed, SETTINGS.moveScheme);
      this.setMoveCells(moveCells);
    }

    this.setAttackCells([]);
    
    // No next fighter id = draw finished
    if (!this.getNextFighterId()) {
      console.log("[Game] Draw finished");
      this.callbackDrawFinished();
    }

    this._ctrl.events.flush();
  }
  
  protected callbackDrawFinished(): void {
    this._enemySquad.callbackDrawFinished();
    this._userSquad.callbackDrawFinished();
  }

  public createInitiativeRating(): void {
    this._state.initiativeRating = _.orderBy(
      _.union(
        this._userSquad.getState().units,
        this._enemySquad.getState().units
      ).map(unit => {
        return {
          fighterId: unit.fighterId,
          initiative: unit.initiative,
          active: false
        } as BattleInitiativeRatingEntry;
      }),
      ["initiative", "desc"]
    );
    console.log("[Game] Initiative rating was created", this._state.initiativeRating);
    //console.log("createInitiativeRating", { initiativeRating: this._state.initiativeRating });
  }

  public refreshInitiativeRating(){
    if (!this._state.initiativeRating) {
      throw Error("Cannot refresh empty initiativeRating");
    }
    this._state.initiativeRating = _.orderBy(
      this._state.initiativeRating,
      ["initiative", "desc"]
    );
    console.log("[Game] Initiative rating was refreshed", this._state.initiativeRating);
  }

  public chooseAbility(abilityClass: string): void {
    // Find a fighter
    const fighter = this._userSquad.getFighter(this._state.combat.activeFighterId);
    if (!fighter) {
      return;
    }

    if (abilityClass === ABILITY_MOVE) {
      const moveCells = this._movement.getRangeCells("move", fighter.index, fighter.speed, SETTINGS.moveScheme);
      this.setMoveCells(moveCells);
      this.setAttackCells([]);
    } else {
      if (!fighter.canUseAbility(abilityClass)) {
        return;
      }
      const attackCells = this._combat.getAttackCells(fighter, abilityClass, false);
      this.setAttackCells(attackCells);
      this.setMoveCells([]);
    }
  }

  public apply(index: number|null, ability: string|null): void {
    if (!this._state.combat.activeFighterId) {
      return;
    }

    // Find a fighter
    const fighter = this._userSquad.getFighter(this._state.combat.activeFighterId);
    if (!fighter) {
      return;
    }

    this.handleAction(fighter, index, ability, false);
    //console.log(this._userSquad.units);
  }
  
  public autoMove(fighter: Unit): void {
    let index = null;
    let ability = fighter.strongestEnabledAbility();
    let attackCells = this._combat.getAttackCells(fighter, ability, true);
    if (attackCells.length) {
      index = _.sample(attackCells);
      console.log('[Game] AI attacks', { attackCells, index });
    } else {
      ability = ABILITY_MOVE;
      const moveCells = this._movement.getRangeCells("move", fighter.index, fighter.speed, SETTINGS.moveScheme);
      index = _.sample(moveCells);
      console.log('[Game] AI moves', { moveCells, choosedIndex: index });
    }

    this.handleAction(fighter, index, ability, true);
  }
  
  protected handleAction(fighter: Unit, index: number|null, ability: string|null, timeout: boolean): void {
    console.log("[Action] Data", { fighter, index, ability, timeout });
    
    // Check if unit can use ability
    // Check ability cooldown
    if (
      ability
      &&
      !fighter.canUseAbility(ability)
    ) {
      return;
    }

    const abilityType = ability ? ABILITY_TYPES[ability] : null;
    const target = index === null ? null : this.getFighterByIndex(index);

    // Move
    if (index !== null && ability === ABILITY_MOVE) {
      console.log("[Action] Move", { fighter, index });
      this._movement.moveFighter(fighter, index);
      
    // Heal
    } else if (index !== null && abilityType === ABILITY_TYPE_HEALING && target !== null) {
      console.log("[Action] Heal", { fighter, target, ability });
      this._combat.heal(fighter, target, ability);

    // Group heal
    } else if (index === null && abilityType === ABILITY_TYPE_HEALING && ability === ABILITY_GROUP_HEAL) {
      console.log("[Action] Group heal", { fighter, ability });
      this._combat.groupHeal(fighter, ability);

    // Jump
    } else if (index !== null && abilityType === ABILITY_TYPE_JUMP && target === null) {
      console.log("[Action] Jump", { fighter, index });
      this._movement.moveFighter(fighter, index);
      
    // Buff / De-buff
    } else if (index !== null && [ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF].includes(abilityType) && target !== null) {
      console.log("[Action] Duff/De-buff", { fighter, target, ability });
      this._combat.buff(fighter, target, ability);
      
    // Self-buff
    } else if (index === null && abilityType === ABILITY_TYPE_SELF_BUFF && target === null) {
      console.log("[Action] Self-buff", { fighter, ability });
      this._combat.buff(fighter, fighter, ability);
      
    // Attack
    } else if (index !== null && abilityType === ABILITY_TYPE_ATTACK && target !== null) {
      console.log("[Action] Attack", { fighter, target, ability });
      this._combat.attack(fighter, target, ability);

    } else {
      throw Error("Unknown action");
    }

    // Enable ability cooldown
    if (ability && ![ABILITY_ATTACK, ABILITY_MOVE].includes(ability)) {
      fighter.enableAbilityCooldown(ability);
      console.log("[Game] Ability cooldown was set", fighter.getAbilityByClass(ability));
    }

    this._ctrl.events.flush();

    // Launch next unit turn
    if (timeout) {
      const self = this;
      this._aiMoveTimeout = setTimeout(function(){ 
        self.nextFighter(); 
      }, 1500);
    } else {
      this.nextFighter();
    }
  }

  public getFighterByIndex(index: number): Unit|null {
    return _.union(
      this._userSquad.units,
      this._enemySquad.units
    ).find(unit => unit.index === index) || null;
  }

  public getSquadByFighter(fighter: Unit): BattleSquad {
    if (fighter.isEnemy) {
      return this._enemySquad;
    } else {
      return this._userSquad;
    }
  }

  protected setMoveCells(cells: number[]): void {
    this._state.combat.runtime.moveCells = cells;
    this._ctrl.events.combatMoveCells(cells); 
  }

  protected setAttackCells(cells: number[]): void {
    this._state.combat.runtime.attackCells = cells;
    this._ctrl.events.combatAttackCells(cells);
  }

  protected setActiveFighter(fighterId: string|null): void {
    if (!this._state.initiativeRating.length) {
      //this.createInitiativeRating();
    }

    this._state.initiativeRating.forEach(entry => {
      entry.active = false;
    });

    if (!fighterId) {
      fighterId = this._state.initiativeRating[0].fighterId;
      this._state.initiativeRating[0].active = true;
    } else {
      const index = this._state.initiativeRating.findIndex(entry => entry.fighterId === fighterId);
      this._state.initiativeRating[index].active = true;
    }

    this.setActiveFighterId(fighterId);
  }

  protected setActiveFighterId(fighterId: string|null): void {
    this._state.combat.activeFighterId = fighterId;
    this._ctrl.events.activeFighterId(fighterId);
  }

  protected getNextFighterId(): string|null {
    if (!this._state.initiativeRating.length) {
      //this.createInitiativeRating();
    }
    
    let fighterId = null;
    const index = this._state.initiativeRating.findIndex(entry => entry.active === true);
    if (this._state.initiativeRating[index+1]) {
      fighterId = this._state.initiativeRating[index+1].fighterId;
    } else {
      fighterId = null;
    }
    return fighterId;
  }

  public skip(): void {
    this.nextFighter();
  }

  public exit(): void {
    clearTimeout(this._aiMoveTimeout);

    this.setMode(null);
    this.setDifficulty(null);
    this.setCombatStarted(false);
    this.setCombatResult(null);
    this.setActiveFighterId(null);
    this.setMoveCells([]);
    this.setAttackCells([]);

    this._state.enemySquad = null;
    this._ctrl.events.enemySquad(null);
    
    this._state.initiativeRating = [];
    this._ctrl.events.initiativeRating([]);

    console.log("[Game] Exit");
  }
}