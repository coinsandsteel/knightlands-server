import _ from "lodash";
import { ABILITY_TYPE_ATTACK, ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF, ABILITY_TYPE_HEALING, ABILITY_TYPE_SELF_BUFF, ABILITY_TYPES, GAME_DIFFICULTY_HIGH, GAME_DIFFICULTY_LOW, GAME_DIFFICULTY_MEDIUM, GAME_MODE_DUEL, ABILITY_GROUP_HEAL, ABILITY_ATTACK, ABILITY_MOVE, ABILITY_FLIGHT, ABILITY_DASH, ABILITY_RUSH } from "../../../knightlands-shared/battle";
import errors from "../../../knightlands-shared/errors";
import { BattleCore } from "./BattleCore";
import { SQUAD_BONUSES } from "../meta";
import { BattleGameState, BattleInitiativeRatingEntry, BattleTerrainMap, BattleUnit } from "../types";
import { Unit } from "../units/Unit";
import { BattleCombat } from "./BattleCombat";
import { BattleMovement } from "./BattleMovement";
import { BattleService } from "./BattleService";
import { BattleSquad } from "./BattleSquad";
import { BattleTerrain } from "./BattleTerrain";
import game from "../../../game";

export class BattleGame extends BattleService {
  protected _state: BattleGameState;
  protected _core: BattleCore;
  
  protected _userSquad: BattleSquad;
  protected _enemySquad: BattleSquad;
  protected _enemyOptions: (any[][]|null) = null;

  protected _combat: BattleCombat;
  protected _movement: BattleMovement;
  protected _terrain: BattleTerrain;
  protected _aiMoveTimeout: ReturnType<typeof setTimeout>;
 
  constructor(state: BattleGameState|null, core: BattleCore) {
    super();
    this._core = core;

    this._userSquad = new BattleSquad(
      state ? state.userSquad.units : [],
      false,
      this._core
    );
    this._enemySquad = new BattleSquad(
      state ? state.enemySquad.units : [], 
      true,
      this._core
    );

    if (state) {
      this._state = state;
      this.log("Loaded initiative rating", this._state.initiativeRating);
    } else {
      this.setInitialState();
    }


    this._movement = new BattleMovement(this._core);
    this._combat = new BattleCombat(this._core);
    this._terrain = new BattleTerrain(this._state.terrain, this._core);

    this.log("Loaded");
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

  get combat(): BattleCombat {
    return this._combat;
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

  get userSquad(): BattleSquad {
    return this._userSquad;
  }

  get enemySquad(): BattleSquad {
    return this._enemySquad;
  }

  get userUnits(): Unit[] {
    return this._userSquad.units;
  }

  get enemyUnits(): Unit[] {
    return this._enemySquad.units;
  }

  public dispose() {
    this.log("Shutting down", this._state);
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
        activeFighterId: null,
        runtime: {
          selectedIndex: null,
          selectedAbilityClass: null,
          moveCells: [],
          attackCells: [],
          targetCells: []
        }
      }
    } as BattleGameState;

    this.log("Initial state was set");
  }

  public getState(): BattleGameState {
    this._state.userSquad = this._userSquad.getState();
    this._state.enemySquad = this._enemySquad.getState();
    this._state.terrain = this._terrain.getState();
    return this._state;
  }

  public init(): void {
    this.log("Init", this._state);
    
    // Combat started
    if (this.combatStarted) {
      this.log("Resuming combat");
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

    //this.log("Build squad", { unitTribe, tier });
    for (let squadIndex = 0; squadIndex < 5; squadIndex++) {
      this.addUnitToSquad({ unitTribe }, tier, squadIndex);
    }
  }

  public addUnitToSquad(params: { unitTribe?: string, unitClass?: string }, tier: number, squadIndex: number) {
    const blueprint = this._core.inventory.getRandomUnitByProps(params, tier);
    /*this.log("New squad member blueprint", { 
      unitId: blueprint.unitId, 
      tribe: blueprint.tribe, 
      unitClass: blueprint.class, 
      tier: blueprint.tier 
    });*/
    
    let unit = this._core.inventory.getUnitByFilter({ template: blueprint.template, tier });
    if (!unit) {
      unit = this._core.inventory.addUnit(blueprint);
    }

    this._userSquad.fillSlot(unit.unitId, squadIndex);
  }

  public maximizeUserSquad(): void {
    this._userSquad.maximize();
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
  
  public enterVirtualDuel(userSquad: BattleUnit[], enemySquad: BattleUnit[]): void {
    // Start combat
    this.setInitiativeRating();

    // Sync & flush
    this.sync();
    this._core.events.flush();

    this.nextFighter();
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

    this.spawnEnemySquad(this._enemyOptions[difficulties[difficulty]]);
    this._enemySquad.init();
    this._enemySquad.regenerateFighterIds();
    this._enemySquad.arrange();

    this.spawnUserSquad(this._state.userSquad.units);
    this._userSquad.init();
    this._userSquad.regenerateFighterIds();
    this._userSquad.arrange();
    
    // Terrain
    this.terrain.setRandomMap();

    // Start combat
    this.setCombatStarted(true);
    this.setInitiativeRating();

    // Sync & flush
    this.sync();
    this._core.events.flush();

    this.nextFighter();
  }
  
  public spawnUserSquad(userSquad: BattleUnit[]) {
    this._userSquad = new BattleSquad(userSquad, false, this._core);
  }
  
  public spawnEnemySquad(enemySquad: BattleUnit[]) {
    this._enemySquad = new BattleSquad(enemySquad, true, this._core);
    this._enemyOptions = null;
  }

  public setTerrain(map: BattleTerrainMap) {
    this._terrain.setMap(map);
  }

  public sync() {
    this._core.events.userSquad(this._userSquad.getState());
    this._core.events.enemySquad(this._enemySquad.getState());
  }

  public getDuelOptions() {
    const unitTribe = _.sample(_.cloneDeep(Object.keys(SQUAD_BONUSES)));
    const squads = [[], [], []];
    
    for (let tier = 1; tier <= 3; tier++) {
      for (let index = 0; index < 5; index++) {
        const unit = this._core.inventory.getRandomUnitByProps({ unitTribe }, tier);
        squads[tier-1].push(unit.serializeForSquad());
      }
    }
    
    this._enemyOptions = squads;

    return squads;
  }
  
  public setMode(mode: string): void {
    this._state.mode = mode;
    this._core.events.mode(mode);
  }
  
  public setDifficulty(difficulty: string): void {
    this._state.difficulty = difficulty;
    this._core.events.difficulty(difficulty);
  }
  
  public setCombatStarted(value: boolean): void {
    this._state.combat.started = value;
    this._core.events.combatStarted(value);
  }
  
  public setCombatResult(value: string|null): void {
    this._state.combat.result = value;
    this._core.events.combatResult(value);
    
    if (value) {
      this.log("Combat finished", { result: value});
      this.exit(value);
    }
  }
  
  public nextFighter(skipLaunch?: boolean): void {
    if (!this._state.initiativeRating || !this._state.initiativeRating.length) {
      throw Error("No initiative rating. Cannot choose next fighter.");
    }

    this.log("Choosing the next fighter...", { skipLaunch });
    
    // No active fighter
    if (!this.getActiveFighter()) {
      this.log("No active fighter. Choosing the first one.");
      this.setActiveFighter(null);
    // Next fighter
    } else {
      const nextFighterId = this.getNextFighterId();
      this.log(`[Game] Now active fighter is ${nextFighterId}`);
      this.setActiveFighter(nextFighterId);
    }

    const activeFighter = this.getActiveFighter();
    if (activeFighter.isDead) {
      this.log("Active fighter is dead. Choosing the next one.");
      this.nextFighter(true);
    }

    if (!skipLaunch) {
      this.launchFighter();
    }
  }
  
  public launchFighter(): void {
    const activeFighter = this.getActiveFighter();
    if (!activeFighter) {
      return;
    }

    if (activeFighter.isStunned) {
      this.log(`[Game] Active fighter ${this._state.combat.activeFighterId} is stunned. Skip...`);
      this.skip();
      return;
    }

    if (activeFighter.isEnemy) {
      this.log(`[Game] Active fighter is ${this._state.combat.activeFighterId} (enemy). Making a move...`);
      this.setMoveCells([]);
      this.autoMove(activeFighter);
      
    } else {
      this.log(`[Game] Active fighter is ${this._state.combat.activeFighterId} (user's). Showing move cells.`);
      const moveCells = this._movement.getMoveCellsByAbility(activeFighter, ABILITY_MOVE);
      this.setMoveCells(moveCells);
    }
    
    this.setTargetCells([]);
    this.setAttackCells([]);
    
    // No next fighter id = draw finished
    if (!this.getNextFighterId()) {
      this.log("Draw finished");
      this.callbackDrawFinished();
    }

    this._core.events.flush();
  }
  
  public callbackDrawFinished(): void {
    this.setInitiativeRating();
    this._enemySquad.callbackDrawFinished();
    this._userSquad.callbackDrawFinished();
    this.sync();
  }

  public setInitiativeRating(): void {
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
    this._core.events.initiativeRating(this._state.initiativeRating);
  }

  public chooseAbility(abilityClass: string): void {
    // Find a fighter
    const fighter = this._userSquad.getFighter(this._state.combat.activeFighterId);
    if (!fighter) {
      return;
    }

    if ([ABILITY_MOVE, ABILITY_DASH, ABILITY_FLIGHT].includes(abilityClass)) {
      const moveCells = this._movement.getMoveCellsByAbility(fighter, abilityClass);
      this.setMoveCells(moveCells);
      this.setAttackCells([]);
      this.setTargetCells([]);
    } else {
      if (!fighter.abilities.canUseAbility(abilityClass)) {
        return;
      }
      const attackAreaData = this._combat.getAttackAreaData(fighter, abilityClass, true);
      this.setAttackCells(attackAreaData.attackCells);
      this.setTargetCells(attackAreaData.targetCells);

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

    this.handleAction(fighter, index, ability);
    this.handleActionCallback(false);
    //this.log(this._userSquad.units);
  }
  
  public autoMove(fighter: Unit): void {
    let index = null;
    let ability = fighter.abilities.strongestEnabledAbility();
    let attackAreaData = this._combat.getAttackAreaData(fighter, ability, true);
    if (attackAreaData.targetCells.length && ability) {
      index = _.sample(attackAreaData.targetCells);
      this.log("AI attacks", { attackAreaData, index, ability });
    } else {
      ability = ABILITY_MOVE;
      const moveCells = this._movement.getMoveCellsByAbility(fighter, ability);
      index = _.sample(moveCells);
      this.log("AI moves", { moveCells, choosedIndex: index });
    }

    this.handleAction(fighter, index, ability);
    this.handleActionCallback(true);
  }
  
  public handleAction(fighter: Unit, index: number|null, ability: string|null): void {
    this.log("Action", { fighter: fighter.fighterId, index, ability });
    
    // Check if unit can use ability
    // Check ability cooldown
    if (
      fighter.isStunned
      ||
      fighter.isDead
    ) {
      this.log("Fighter cannot attack. Abort.");
      return;
    }

    // Check if unit can use ability
    // Check ability cooldown
    if (
      ability
      &&
      !fighter.abilities.canUseAbility(ability)
    ) {
      this.log("Fighter cannot use this ability. Abort.");
      return;
    }

    const target = index === null ? null : this.getFighterByIndex(index);
    if (ability) {
      const abilityMeta = game.battleManager.getAbilityMeta(ability);
    }

    if (ability !== ABILITY_MOVE && target && target.isDead) {
      this.log("Target is dead. Abort.");
      return;
    }

    // Dash >
    // Flight >
    // Rush >+

    // Move / Dash / Flight
    // TODO update
    /*if (index !== null && [ABILITY_MOVE, ABILITY_DASH, ABILITY_FLIGHT].includes(ability)) {
      this.log("Move", { fighter: fighter.fighterId, index });
      this._movement.moveFighter(fighter, ability, index);
      
    // Self-buff
    } else if (abilityType === ABILITY_TYPE_SELF_BUFF) {
      this.log("Self-buff", { fighter: fighter.fighterId, ability });
      this._combat.buff(fighter, fighter, ability);
      
    // Group heal
    } else if (index === null && ability === ABILITY_GROUP_HEAL) {
      this.log("Group heal", { fighter: fighter.fighterId, ability });
      this._combat.groupHeal(fighter, ability);

    } else if (index !== null && target !== null) {
      // Can't reach
      const attackAreaData = this._combat.getAttackAreaData(fighter, ability, true);
      if (!attackAreaData.targetCells.includes(target.index)) {
        this.log("Can't reach. Abort.", { attackAreaData });
        return;
      }

      // Approach enemy if necessery
      this._combat.tryApproachEnemy(fighter, target, ability);

      // TODO check range

      // Buff / De-buff
      if ([ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF].includes(abilityType)) {
        this.log("Buff/De-buff", { fighter: fighter.fighterId, target: target.fighterId, ability });
        this._combat.buff(fighter, target, ability);

      // Heal
      } else if (abilityType === ABILITY_TYPE_HEALING) {
        this.log("Heal", { fighter: fighter.fighterId, target: target.fighterId, ability });
        this._combat.heal(fighter, target, ability);

      // Attack
      } else if (abilityType === ABILITY_TYPE_ATTACK || ability === ABILITY_RUSH) {
        this.log("Attack", { fighter: fighter.fighterId, target: target.fighterId, ability });
        this._combat.attack(fighter, target, ability);

        // Counter-attack
        if (target.wantToCounterAttack) {
          this.log("Counter-attack!", { fighter: fighter.fighterId, target: target.fighterId });
          const attackAreaData = this._combat.getAttackAreaData(fighter, ABILITY_ATTACK, false);
          if (attackAreaData.targetCells.includes(fighter.index)) {
            this._combat.attack(target, fighter, ABILITY_ATTACK);
          }
        }
      }
    } else {
      return;
    }*/
  }

  public handleActionCallback(timeout: boolean) {
    this.log("Emenies left", this._enemySquad.liveUnits.length);
    this.log("Aliies left", this._userSquad.liveUnits.length);

    // Enemy loose
    if (!this._enemySquad.liveUnits.length) {
      this.setCombatResult("win");
      
    // User loose
    } else if (!this._userSquad.liveUnits.length) {
      this.setCombatResult("loose");
    }

    this._core.events.flush();

    // Finish the combat
    if (this._state.combat.result) {
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
      this._userSquad.liveUnits,
      this._enemySquad.liveUnits
    ).find(unit => unit.index === index) || null;
  }

  public getSquadByFighter(fighter: Unit): Unit[] {
    if (fighter.isEnemy) {
      return this._enemySquad.liveUnits;
    } else {
      return this._userSquad.liveUnits;
    }
  }

  public getEnemySquadByFighter(fighter: Unit): Unit[] {
    if (fighter.isEnemy) {
      return this._userSquad.liveUnits;
    } else {
      return this._enemySquad.liveUnits;
    }
  }

  public setMoveCells(cells: number[]): void {
    this._state.combat.runtime.moveCells = cells;
    this._core.events.combatMoveCells(cells); 
  }

  public setAttackCells(cells: number[]): void {
    this._state.combat.runtime.attackCells = cells;
    this._core.events.combatAttackCells(cells);
  }

  public setTargetCells(cells: number[]): void {
    this._state.combat.runtime.targetCells = cells;
    this._core.events.combatTargetCells(cells);
  }

  public setActiveFighter(fighterId: string|null): void {
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
    this._core.events.initiativeRating(this._state.initiativeRating);

    //this.log("Initiative rating", this._state.initiativeRating);
    
    this.setActiveFighterId(fighterId);
  }

  public setActiveFighterId(fighterId: string|null): void {
    this._state.combat.activeFighterId = fighterId;
    this._core.events.activeFighterId(fighterId);
  }

  protected getNextFighterId(): string|null {
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

  public exit(result?: null|string): void {
    clearTimeout(this._aiMoveTimeout);

    this.setMode(null);
    this.setDifficulty(null);
    this.setCombatStarted(false);
    this.setActiveFighterId(null);
    this.setMoveCells([]);
    this.setAttackCells([]);
    this.setTargetCells([]);
    this.setCombatResult(result || null);
    
    this._state.enemySquad = this._enemySquad.getInitialState();
    this._core.events.enemySquad(this._state.enemySquad);
    
    this._state.initiativeRating = [];
    this._core.events.initiativeRating([]);

    this.log("Exit");
  }
}