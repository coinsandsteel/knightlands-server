import _ from "lodash";
import { ABILITY_TYPE_ATTACK, ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF, ABILITY_TYPE_HEALING, ABILITY_TYPE_JUMP, ABILITY_TYPE_SELF_BUFF, ABILITY_TYPES, GAME_DIFFICULTY_HIGH, GAME_DIFFICULTY_LOW, GAME_DIFFICULTY_MEDIUM, GAME_MODE_DUEL, ABILITY_GROUP_HEAL, ABILITY_ATTACK, UNIT_CLASS_MELEE, UNIT_CLASS_RANGE, UNIT_CLASS_MAGE, UNIT_CLASS_TANK, UNIT_CLASS_SUPPORT, UNIT_TRIBE_KOBOLD } from "../../../knightlands-shared/battle";
import errors from "../../../knightlands-shared/errors";
import { BattleController } from "../BattleController";
import { SETTINGS, SQUAD_BONUSES, TERRAIN } from "../meta";
import { BattleGameState, BattleInitiativeRatingEntry } from "../types";
import { Unit } from "../units/Unit";
import { BattleCombat } from "./BattleCombat";
import { BattleMovement } from "./BattleMovement";
import { BattleSquad } from "./BattleSquad";

export class BattleGame {
  protected _state: BattleGameState;
  protected _ctrl: BattleController;
  
  protected _userSquad: BattleSquad;
  protected _enemySquad: BattleSquad;
  protected _enemyOptions: any[][];

  protected _combat: BattleCombat;
  protected _movement: BattleMovement;

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

    this._movement = new BattleMovement(this._ctrl);
    this._combat = new BattleCombat(this._ctrl);
  }

  get relativeEnemySquad(): Unit[] {
    const index = this._userSquad.units.findIndex(unit => unit.fighterId === this._state.combat.activeFighterId);
    return index !== -1 ? this._enemySquad.units : this._userSquad.units;
  }

  get movement(): BattleMovement {
    return this._movement;
  }

  get combatStarted(): boolean {
    return this._state.combat.started;
  }

  get allUnits(): Unit[] {
    return [...this._userSquad.units, ...this._enemySquad.units];
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
      terrain: [],

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
  }

  public getState(): BattleGameState {
    this._state.userSquad = this._userSquad.getState();
    this._state.enemySquad = this._enemySquad.getState();
    return this._state;
  }

  public init(): void {
    this._userSquad.init();
    this._enemySquad.init();
    if (!this._state.initiativeRating ||!this._state.initiativeRating.length) {
      this.createInitiativeRating();
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
    this._enemySquad = new BattleSquad(squad, this._ctrl);
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
    this._state.terrain = TERRAIN[0];
    this._ctrl.events.terrain(this._state.terrain);

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
  
  public nextFighter(): void {
    if (!this._state.initiativeRating || !this._state.initiativeRating.length) {
      return;
    }

    let fighterId = null;
    const index = this._state.initiativeRating.findIndex(entry => entry.active === true);

    if (index === -1) {
      fighterId = this._state.initiativeRating[0].fighterId;
      this._state.initiativeRating[0].active = true;
    } else {
      this._state.initiativeRating[index].active = false;
      if (this._state.initiativeRating[index+1]) {
        fighterId = this._state.initiativeRating[index+1].fighterId;
        this._state.initiativeRating[index+1].active = true;
      } else {
        fighterId = this._state.initiativeRating[0].fighterId;
        this._state.initiativeRating[0].active = true;
      }
    }

    this._state.combat.activeFighterId = fighterId;
    this._ctrl.events.activeFighterId(fighterId);

    // Find a fighter
    const fighter = this._userSquad.getFighter(fighterId) || this._enemySquad.getFighter(fighterId) || null;
    if (!fighter) {
      return;
    }

    const isEnemy = this._enemySquad.includesFighter(fighterId);
    console.log("Active fighter is", { fighterId: fighter.fighterId, isEnemy });
    
    if (this._enemySquad.includesFighter(fighterId)) {
      this._ctrl.events.combatMoveCells([]);
      this.autoMove(fighter);
    } else {
      const moveCells = this._movement.getRangeCells(fighter.index, fighter.speed, SETTINGS.moveScheme);
      this._ctrl.events.combatMoveCells(moveCells);
    }
    this._ctrl.events.combatAttackCells([]);
    
    this._ctrl.events.flush();
  }
  
  public createInitiativeRating(): void{
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
    //console.log("createInitiativeRating", { initiativeRating: this._state.initiativeRating });
  }

  public refreshInitiativeRating(){
    if (!this._state.initiativeRating) {
      return;
    }
    this._state.initiativeRating = _.orderBy(
      this._state.initiativeRating, 
      ["initiative", "desc"]
    );
  }

  public chooseAbility(abilityClass: string): void {
    // Find a fighter
    const fighter = this._userSquad.getFighter(this._state.combat.activeFighterId);
    if (!fighter) {
      return;
    }

    if (abilityClass === "move") {
      const moveCells = this._movement.getRangeCells(fighter.index, fighter.speed, SETTINGS.moveScheme);
      this._ctrl.events.combatMoveCells(moveCells);
      this._ctrl.events.combatAttackCells([]);
    } else {
      if (!fighter.canUseAbility(abilityClass)) {
        return;
      }
      const attackCells = this._combat.getAttackCells(fighter, abilityClass, false);
      this._ctrl.events.combatAttackCells(attackCells);
      this._ctrl.events.combatMoveCells([]);
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
    let ability = null;
    let index = null;

    const attackCells = this._combat.getAttackCells(fighter, ability, true);
    if (attackCells.length) {
      ability = fighter.strongestEnabledAbility();
      index = _.sample(attackCells);
      console.log('Auto attack', { attackCells, index });
    } else {
      const moveCells = this._movement.getRangeCells(fighter.index, fighter.speed, SETTINGS.moveScheme);
      index = _.sample(moveCells);
      console.log('Auto move', { moveCells, index });
    }

    this.handleAction(fighter, index, ability, true);
  }
  
  protected handleAction(fighter: Unit, index: number|null, ability: string|null, timeout: boolean): void {
    console.log('handleAction', { fighter: fighter.fighterId, index, ability });

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
    if (index !== null && ability === null && target === null) {
      this._movement.moveFighter(fighter, index);
      
    // Heal
    } else if (index !== null && abilityType === ABILITY_TYPE_HEALING && target !== null) {
      this._combat.heal(fighter, target, ability);

    // Group heal
    } else if (index === null && abilityType === ABILITY_TYPE_HEALING && ability === ABILITY_GROUP_HEAL) {
      this._combat.groupHeal(fighter, ability);

    // Jump
    } else if (index !== null && abilityType === ABILITY_TYPE_JUMP && target === null) {
      this._movement.moveFighter(fighter, index);
      
    // Buff / De-buff
    } else if (index !== null && [ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF].includes(abilityType) && target !== null) {
      this._combat.buff(fighter, target, ability);
      
    // Self-buff
    } else if (index === null && abilityType === ABILITY_TYPE_SELF_BUFF && target === null) {
      this._combat.buff(fighter, fighter, ability);
      
    // Attack
    } else if (index !== null && abilityType === ABILITY_TYPE_ATTACK && target !== null) {
      // Deal damage
      this._combat.attack(fighter, target, ability);

    } else {
      throw errors.IncorrectArguments;
    }

    if (ability && ability !== ABILITY_ATTACK) {
      fighter.enableAbilityCooldown(ability);
      console.log("Cooldown set", fighter.getAbilityByClass(ability));
    }

    this._ctrl.events.flush();

    // Launch next unit turn
    setTimeout(() => this.nextFighter(), timeout ? 1500 : 0);
  }

  public getFighterByIndex(index: number): Unit|null {
    return _.union(
      this._userSquad.units,
      this._enemySquad.units
    ).find(unit => unit.index === index) || null;
  }

  public getSquadByFighter(fighter: Unit): BattleSquad {
    if (this._userSquad.includesFighter(fighter.fighterId)) {
      return this._userSquad;
    }
    if (this._enemySquad.includesFighter(fighter.fighterId)) {
      return this._enemySquad;
    }
    throw errors.IncorrectArguments;
  }

  public skip(): void {}

  public exit(): void {}
}