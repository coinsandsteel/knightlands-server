import _ from "lodash";
import game from "../../../game";
import { ABILITY_TYPE_ATTACK, ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF, ABILITY_TYPE_HEALING, ABILITY_TYPE_JUMP, ABILITY_TYPE_SELF_BUFF, ABILITY_TYPES, GAME_DIFFICULTY_HIGH, GAME_DIFFICULTY_LOW, GAME_DIFFICULTY_MEDIUM, GAME_MODE_DUEL, ABILITY_GROUP_HEAL, ABILITY_ATTACK, UNIT_CLASS_MELEE, UNIT_CLASS_RANGE, UNIT_CLASS_MAGE, UNIT_CLASS_TANK, UNIT_CLASS_SUPPORT, UNIT_TRIBE_KOBOLD, ABILITY_MOVE } from "../../../knightlands-shared/battle";
import errors from "../../../knightlands-shared/errors";
import { BattleController } from "../BattleController";
import { SQUAD_BONUSES } from "../meta";
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
  protected _enemyOptions: (any[][]|null) = null;

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
    return activeFighter.isEnemy ? this._userSquad.liveUnits : this._enemySquad.liveUnits;
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
    return [
      ...this._userSquad.liveUnits, 
      ...this._enemySquad.liveUnits
    ];
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
    
    if (this._userSquad) {
      this._userSquad.init();
    }
    
    if (this._enemySquad) {
      this._enemySquad.init();
    }

    this.sync();

    if (this._state.combat.started) {
      console.log("[Game] Resuming combat", this._state);
      this.launchFighter();
    }
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
    const unitTribe = _.sample(_.cloneDeep(Object.keys(SQUAD_BONUSES)));
    const tier = _.random(1, 3);

    //console.log("[Game] Build squad", { unitTribe, tier });
    for (let squadIndex = 0; squadIndex < 5; squadIndex++) {
      this.addUnitToSquad({ unitTribe }, tier, squadIndex);
    }
  }

  public addUnitToSquad(params: { unitTribe?: string, unitClass?: string }, tier: number, squadIndex: number) {
    const blueprint = this._ctrl.inventory.getRandomUnitByProps(params, tier);
    /*console.log("[Game] New squad member blueprint", { 
      unitId: blueprint.unitId, 
      tribe: blueprint.tribe, 
      unitClass: blueprint.class, 
      tier: blueprint.tier 
    });*/
    
    let unit = this._ctrl.inventory.getUnitByFilter({ template: blueprint.template, tier });
    if (!unit) {
      unit = this._ctrl.inventory.addUnit(blueprint);
    }
    
    if (game.battleManager.autoCombat) {
      unit.maximize();
    }

    this._userSquad.fillSlot(unit.unitId, squadIndex);
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

    if (!this._enemyOptions) {
      throw errors.IncorrectArguments;
    }

    const squad = this._enemyOptions[difficulties[difficulty]];
    this._enemySquad = new BattleSquad(squad, true, this._ctrl);
    this._enemyOptions = null;

    // Prepare user Squad
    this._userSquad.init();
    
    // Prepare enemy squad
    this._enemySquad.init();
    this._enemySquad.regenerateFighterIds();
    
    // Terrain
    this._terrain.setRandomMap();

    // Start combat
    this.setCombatStarted(true);
    this.createInitiativeRating();

    // Sync & flush
    this.sync();
    this._ctrl.events.flush();

    this.nextFighter();
  }
  
  public sync() {
    this._ctrl.events.userSquad(this._userSquad.getState());
    this._ctrl.events.enemySquad(this._enemySquad.getState());
  }

  public getDuelOptions() {
    const unitTribe = _.sample(_.cloneDeep(Object.keys(SQUAD_BONUSES)));
    const squads = [[], [], []];
    
    for (let tier = 1; tier <= 3; tier++) {
      for (let index = 0; index < 5; index++) {
        const unit = this._ctrl.inventory.getRandomUnitByProps({ unitTribe }, tier);
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
    
    if (value) {
      console.log("[Game] Combat finished", { result: value});
      this.exit(value);
    }
  }
  
  public nextFighter(skipLaunch?: boolean): void {
    if (!this._state.initiativeRating || !this._state.initiativeRating.length) {
      throw Error("No initiative rating. Cannot choose next fighter.");
    }

    console.log("[Game] Choosing the next fighter...", { skipLaunch });
    
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

    const activeFighter = this.getActiveFighter();
    if (activeFighter.isDead) {
      console.log("[Game] Active fighter is dead. Choosing the next one.");
      this.nextFighter(true);
    }

    if (!skipLaunch) {
      this.launchFighter();
    }
  }
  
  public launchFighter(): void {
    const activeFighter = this.getActiveFighter();
    if (activeFighter.isStunned) {
      console.log(`[Game] Active fighter ${this._state.combat.activeFighterId} is stunned. Skip...`);
      this.skip();
      return;
    }

    if (game.battleManager.autoCombat) {
      console.log(`[Game] Active fighter is ${this._state.combat.activeFighterId}. Making a move...`);
      this.setMoveCells([]);
      this.autoMove(activeFighter);

    } else if (activeFighter.isEnemy) {
      console.log(`[Game] Active fighter is ${this._state.combat.activeFighterId} (enemy). Making a move...`);
      this.setMoveCells([]);
      this.autoMove(activeFighter);

    } else {
      console.log(`[Game] Active fighter is ${this._state.combat.activeFighterId} (user's). Showing move cells.`);
      const moveCells = this._movement.getMoveCells(activeFighter.index, activeFighter.speed);
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
    const entries = _.cloneDeep(this.allUnits)
      .map(unit => {
        return {
          fighterId: unit.fighterId,
          initiative: unit.initiative,
          active: false
        } as BattleInitiativeRatingEntry;
      });

    const rating = _.orderBy(entries, "initiative", "desc");
    
    this._userSquad.setInitiativeRating(rating);
    this._enemySquad.setInitiativeRating(rating);
    this._state.initiativeRating = rating;

    console.log("[Game] Initiative rating was created", this._state.initiativeRating);
  }

  public refreshInitiativeRating(){
    if (!this._state.initiativeRating) {
      throw Error("Cannot refresh empty initiativeRating");
    }
    const rating = _.orderBy(
      this._state.initiativeRating,
      "initiative", 
      "desc"
    );

    this._userSquad.setInitiativeRating(rating);
    this._enemySquad.setInitiativeRating(rating);
    this._state.initiativeRating = rating;

    console.log("[Game] Initiative rating was refreshed", this._state.initiativeRating);
  }

  public chooseAbility(abilityClass: string): void {
    // Find a fighter
    const fighter = this._userSquad.getFighter(this._state.combat.activeFighterId);
    if (!fighter) {
      return;
    }

    if (abilityClass === ABILITY_MOVE) {
      const moveCells = this._movement.getMoveCells(fighter.index, fighter.speed);
      this.setMoveCells(moveCells);
      this.setAttackCells([]);
    } else {
      if (!fighter.canUseAbility(abilityClass)) {
        return;
      }
      const attackCells = this._combat.getAttackCells(fighter, abilityClass, true, false);
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
    let attackCells = this._combat.getAttackCells(fighter, ability, true, true);
    if (attackCells.length && ability) {
      index = _.sample(attackCells);
      console.log('[Game] AI attacks', { attackCells, index, ability });
    } else {
      ability = ABILITY_MOVE;
      const moveCells = this._movement.getMoveCells(fighter.index, fighter.speed);
      index = _.sample(moveCells);
      console.log('[Game] AI moves', { moveCells, choosedIndex: index });
    }

    const timeout = !game.battleManager.autoCombat;
    this.handleAction(fighter, index, ability, timeout);
  }
  
  protected handleAction(fighter: Unit, index: number|null, ability: string|null, timeout: boolean): void {
    console.log("[Game] Action", { fighter, index, ability, timeout });
    
    // Check if unit can use ability
    // Check ability cooldown
    if (
      ability
      &&
      !fighter.canUseAbility(ability)
    ) {
      console.log("[Game] Fighter cannot use this ability. Abort.");
      return;
    }

    const abilityType = ability ? ABILITY_TYPES[ability] : null;
    const target = index === null ? null : this.getFighterByIndex(index);

    if (ability !== ABILITY_MOVE && target && target.isDead) {
      console.log("[Game] Target is dead. Abort.");
      return;
    }

    // Move
    if (index !== null && ability === ABILITY_MOVE) {
      console.log("[Game action] Move", { fighter, index });
      this._movement.moveFighter(fighter, index);
      
    // Jump
    } else if (index !== null && abilityType === ABILITY_TYPE_JUMP && target === null) {
      console.log("[Game action] Jump", { fighter, index });
      this._movement.moveFighter(fighter, index);
      
      // Self-buff
    } else if (index === null && abilityType === ABILITY_TYPE_SELF_BUFF && target === null) {
      console.log("[Game action] Self-buff", { fighter, ability });
      this._combat.buff(fighter, fighter, ability);
      
      // Group heal
    } else if (index === null && abilityType === ABILITY_TYPE_HEALING && ability === ABILITY_GROUP_HEAL) {
      console.log("[Action] Group heal", { fighter, ability });
      this._combat.groupHeal(fighter, ability);

    } else if (index !== null && target !== null) {
      // Can't reach
      const attackCells = this._combat.getAttackCells(fighter, ability, true, true);
      if (!attackCells.includes(target.index)) {
        return;
      }

      // Approach enemy if necessery
      this._combat.tryApproachEnemy(fighter, target, ability);

      // Buff / De-buff
      if ([ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF].includes(abilityType)) {
        console.log("[Game action] Buff/De-buff", { fighter, target, ability });
        this._combat.buff(fighter, target, ability);

      // Heal
      } else if (abilityType === ABILITY_TYPE_HEALING) {
        console.log("[Game action] Heal", { fighter, target, ability });
        this._combat.heal(fighter, target, ability);

      // Attack
      } else if (abilityType === ABILITY_TYPE_ATTACK) {
        console.log("[Game action] Attack", { fighter, target, ability });
        this._combat.attack(fighter, target, ability);
      }
    } else {
      return;
    }

    // Enable ability cooldown
    if (ability && ![ABILITY_ATTACK, ABILITY_MOVE].includes(ability)) {
      fighter.enableAbilityCooldown(ability);
      this._ctrl.events.abilities(fighter.fighterId, fighter.abilities);
      console.log(`[Game] Ability "${ability}" cooldown was set`, fighter.getAbilityByClass(ability).cooldown);
    }

    // Enemy loose
    if (!this._enemySquad.liveUnits.length) {
      this.setCombatResult("win");
      
    // User loose
    } else if (!this._userSquad.liveUnits.length) {
      this.setCombatResult("loose");
    }

    this._ctrl.events.flush();

    // Finish the combat
    if (this._state.combat.result !== null) {
      return;
    }

    // Launch next unit turn
    if (timeout) {
      const self = this;
      this._aiMoveTimeout = setTimeout(function(){ 
        self.nextFighter(); 
      }, 500);
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

  public testAbilities() {
    game.battleManager.enableAutoCombat();

    const allClasses = [
      UNIT_CLASS_MELEE,
      UNIT_CLASS_RANGE, 
      UNIT_CLASS_SUPPORT, 
      UNIT_CLASS_TANK
    ];

    // Build a squad of 4
    this.clearSquadSlot(4);
    allClasses.forEach((unitClass, index) => this.addUnitToSquad({ unitClass }, 3, index));

    // Make duel options
    this.getDuelOptions();
    
    // Enter duel
    this.enterDuel(GAME_DIFFICULTY_MEDIUM);

    game.battleManager.resetMode();
  }

  public skip(): void {
    this.nextFighter();
  }

  public exit(result?: null|string): void {
    clearTimeout(this._aiMoveTimeout);

    this.setMode(null);
    this.setDifficulty(null);
    this.setCombatStarted(false);
    this.setActiveFighterId(null);
    this.setMoveCells([]);
    this.setAttackCells([]);
    this.setCombatResult(result || null);
    
    this._state.enemySquad = this._enemySquad.getInitialState();
    this._ctrl.events.enemySquad(this._state.enemySquad);
    
    this._state.initiativeRating = [];
    this._ctrl.events.initiativeRating([]);

    console.log("[Game] Exit");
  }
}