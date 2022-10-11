import _ from "lodash";
import game from "../../../game";
import {
  ABILITY_ATTACK,
  ABILITY_MOVE, COMMODITY_COINS, COMMODITY_CRYSTALS, COMMODITY_ENERGY, DUEL_REWARDS, GAME_DIFFICULTY_HIGH,
  GAME_DIFFICULTY_LOW,
  GAME_DIFFICULTY_MEDIUM, GAME_MODE_ADVENTURE, GAME_MODE_DUEL
} from "../../../knightlands-shared/battle";
import errors from "../../../knightlands-shared/errors";
import {
  BattleCombatRewards,
  BattleFighter,
  BattleGameState,
  BattleInitiativeRatingEntry,
  BattleTerrainMap
} from "../types";
import { Fighter } from "../units/Fighter";
import { BattleCombat } from "./BattleCombat";
import { BattleCore } from "./BattleCore";
import { BattleMovement } from "./BattleMovement";
import { BattleService } from "./BattleService";
import { BattleSquad } from "./BattleSquad";
import { BattleTerrain } from "./BattleTerrain";

export class BattleGame extends BattleService {
  protected _state: BattleGameState;
  protected _core: BattleCore;

  protected _userSquad: BattleSquad;
  protected _enemySquad: BattleSquad;
  protected _enemyOptions: {
    [difficulty: string]: BattleFighter[]
  } | null = null;

  protected _combat: BattleCombat;
  protected _movement: BattleMovement;
  protected _terrain: BattleTerrain;
  protected _aiMoveTimeout: ReturnType<typeof setTimeout>;

  constructor(state: BattleGameState | null, core: BattleCore) {
    super();
    this._core = core;

    this._userSquad = new BattleSquad(
      state ? state.userSquad.fighters : [],
      false,
      this._core
    );

    this._enemySquad = new BattleSquad(
      state ? state.enemySquad.fighters : [],
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

    this.log("Game created");
  }

  get relativeEnemySquad(): Fighter[] {
    const activeFighter = this.getActiveFighter();
    return activeFighter.isEnemy
      ? this._userSquad.liveFighters
      : this._enemySquad.liveFighters;
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

  get allFighters(): Fighter[] {
    return [...this._userSquad.liveFighters, ...this._enemySquad.liveFighters];
  }

  get userSquad(): BattleSquad {
    return this._userSquad;
  }

  get enemySquad(): BattleSquad {
    return this._enemySquad;
  }

  get userFighters(): Fighter[] {
    return this._userSquad.fighters;
  }

  get enemyFighters(): Fighter[] {
    return this._enemySquad.fighters;
  }

  protected setInitialState() {
    this._state = {
      mode: null,

      userSquad: this._userSquad.getInitialState(),
      enemySquad: this._enemySquad.getInitialState(),
      initiativeRating: [],
      terrain: null,

      combat: {
        started: false,
        result: null, // "win" | "loose"
        activeFighterId: null,
        rewards: {
          coins: 0,
          crystals: 0,
          xp: 0
        },
        runtime: {
          selectedIndex: null,
          selectedAbilityClass: null,
          moveCells: [],
          attackCells: [],
          targetCells: [],
        },
      },
    } as BattleGameState;

    this.log("Initial state was set");
  }

  public getState(): BattleGameState {
    this._state.userSquad = this._userSquad.getState();
    this._state.enemySquad = this._enemySquad.getState();
    this._state.terrain = this._terrain.getState();
    return this._state;
  }

  public load(): void {
    this.log("Game load");
    this.userSquad.load();
    this.enemySquad.load();

    // Combat started
    if (this.combatStarted) {
      this.log("Resuming combat");
      this.launchFighter();
    }
  }

  protected getActiveFighter(): Fighter | null {
    const fighterId = this._state.combat.activeFighterId;
    return (
      this._userSquad.getFighter(fighterId) ||
      this._enemySquad.getFighter(fighterId) ||
      null
    );
  }

  public proxyUnit(unitId: string): void {
    this._userSquad.proxyUnit(unitId);
  }

  public fillSquadSlot(unitId: string, index: number): void {
    this._userSquad.fillSlot(unitId, index);
    this._core.user.checkSquadReward();
  }

  public clearSquadSlot(index: number): void {
    this._userSquad.clearSlot(index);
  }

  public buildSquad(): void {
    for (let squadIndex = 0; squadIndex < 5; squadIndex++) {
      this.addRandomUnitToSquad(squadIndex);
    }
  }

  public addRandomUnitToSquad(squadIndex: number) {
    const newUnit = this._core.inventory.getNewUnitRandom();
    /*this.log("New squad member blueprint", {
      unitId: blueprint.unitId,
      tribe: blueprint.tribe,
      unitClass: blueprint.class,
      tier: blueprint.tier
    });*/

    let unit = this._core.inventory.getUnitByTemplate(newUnit.template);
    if (!unit) {
      unit = this._core.inventory.addUnit(newUnit);
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

  public enterLevel(location: number, level: number): void {
    if (!this._core.adventures.canEnterLevel(location, level)) {
      return;
    }

    this._core.user.modifyBalance(COMMODITY_ENERGY, -this._core.adventures.energyPrice);

    this._core.adventures.setLevel(location, level);
    this.setMode(GAME_MODE_ADVENTURE);

    // Terrain
    const map = this._core.adventures.getMap(location, level);
    this.terrain.setMap(map);

    // Enemy squad
    const enemySquad = this._core.adventures.getEnemySquad(location, level);
    this.start(enemySquad);
  }

  public enterDuel(difficulty: string): void {
    if (!this._enemyOptions) {
      throw errors.IncorrectArguments;
    }

    this.setMode(GAME_MODE_DUEL);

    // Terrain
    this.terrain.setRandomMap();

    const enemyFighters = this._enemyOptions[difficulty];
    this.start(enemyFighters);
  }

  public start(enemyFighters: BattleFighter[]): void {
    if (!this._state.userSquad.fighters.length) {
      return;
    }

    this.spawnEnemySquad(enemyFighters);
    this._enemySquad.load();
    this._enemySquad.regenerateFighterIds();
    this._enemySquad.arrange();

    this.spawnUserSquad(this._state.userSquad.fighters);
    this._userSquad.load();
    this._userSquad.regenerateFighterIds();
    this._userSquad.arrange();

    // Start combat
    this.setCombatStarted(true);
    this.setInitiativeRating();

    // Sync & flush
    this.sync();
    this._core.events.flush();

    this.nextFighter();
  }

  public spawnUserSquad(userSquad: BattleFighter[]) {
    //console.log("Spawn user squad");
    this._userSquad = new BattleSquad(userSquad, false, this._core);
  }

  public spawnEnemySquad(enemySquad: BattleFighter[]) {
    //console.log("Spawn enemy squad");
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
    const enemyOptions = {
      [GAME_DIFFICULTY_LOW]: [],
      [GAME_DIFFICULTY_MEDIUM]: [],
      [GAME_DIFFICULTY_HIGH]: [],
    };
    for (let difficulty in enemyOptions) {
      for (let index = 0; index < 5; index++) {
        const unit = this._core.inventory.getNewUnitRandom();
        const fighter = Fighter.createFighter(unit, true, this._core.events);
        enemyOptions[difficulty].push(fighter.serializeFighter());
      }
    }
    this._enemyOptions = enemyOptions;
    return enemyOptions;
  }

  public getRandomEnemySquad(): BattleFighter[] {
    const squad = [];
    for (let index = 0; index < 5; index++) {
      const unit = this._core.inventory.getNewUnitRandom();
      const fighter = Fighter.createFighter(unit, true, this._core.events);
      squad.push(fighter.serializeFighter());
    }
    return squad;
  }

  public setMode(mode: string): void {
    this._state.mode = mode;
    this._core.events.mode(mode);
  }

  public setCombatStarted(value: boolean): void {
    this._state.combat.started = value;
    this._core.events.combatStarted(value);
  }

  public setCombatResult(value: string | null): void {
    this._state.combat.result = value;
    this._core.events.combatResult(value);

    if (value) {
      this.log("Combat finished", { result: value });
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
      this.log(
        `[Game] Active fighter ${this._state.combat.activeFighterId} is stunned. Skip...`
      );
      this.skip();
      return;
    }

    if (activeFighter.isEnemy) {
      this.log(
        `[Game] Active fighter is ${this._state.combat.activeFighterId} (enemy). Making a move...`
      );
      this.setMoveCells([]);
      this.autoMove(activeFighter);
    } else {
      this.log(
        `[Game] Active fighter is ${this._state.combat.activeFighterId} (user's). Showing move cells.`
      );
      const moveCells = this._movement.getMoveCellsByAbility(
        activeFighter,
        ABILITY_MOVE
      );
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
    const entries = _.cloneDeep(this.allFighters).map((unit) => {
      return {
        fighterId: unit.fighterId,
        initiative: unit.initiative,
        active: false,
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
    const fighter = this._userSquad.getFighter(
      this._state.combat.activeFighterId
    );
    if (!fighter) {
      return;
    }

    if (!fighter.abilities.canUseAbility(abilityClass)) {
      return;
    }

    if (
      abilityClass === ABILITY_MOVE ||
      fighter.abilities.movingOnly(abilityClass)
    ) {
      const moveCells = this._movement.getMoveCellsByAbility(
        fighter,
        abilityClass
      );
      this.setAttackCells([]);
      this.setTargetCells([]);
      this.setMoveCells(moveCells);
    } else {
      const attackAreaData = this._combat.getAttackAreaData(
        fighter,
        abilityClass
      );
      this.setAttackCells(attackAreaData.attackCells);
      this.setTargetCells(attackAreaData.targetCells);
      this.setMoveCells([]);
    }
  }

  public apply(index: number | null, ability: string | null): void {
    if (!this._state.combat.activeFighterId) {
      return;
    }

    // Find a fighter
    const fighter = this._userSquad.getFighter(
      this._state.combat.activeFighterId
    );
    if (!fighter) {
      return;
    }

    this.handleAction(fighter, index, ability);
    this.handleActionCallback(false);
  }

  public autoMove(fighter: Fighter): void {
    let index = null;
    let ability = fighter.abilities.strongestEnabledAbility();
    let attackAreaData = this._combat.getAttackAreaData(fighter, ability);
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

  public handleAction(
    fighter: Fighter,
    index: number | null,
    abilityClass: string | null
  ): void {
    this.log("Action", { fighter: fighter.fighterId, index, abilityClass });

    // Check if unit is dead
    if (fighter.isStunned || fighter.isDead) {
      this.log("Fighter cannot attack. Abort.");
      return;
    }

    const target = index === null ? null : this.getFighterByIndex(index);
    const abilityMeta = fighter.abilities.getMeta(abilityClass);

    // Сheck all restrictions
    if (!this.combat.canApply(fighter, target, abilityClass)) {
      this.log("Cannot apply the target. Abort.");
      return;
    }

    // Check if need to approach
    if (abilityClass === ABILITY_MOVE) {
      this.log("Moving the fighter...");
      this._movement.moveFighter(fighter, abilityClass, index);
      return;
    }

    // Check if need to approach
    if (abilityMeta.canMove) {
      this.combat.tryApproachEnemy(fighter, target, abilityClass);
    }

    // Attack
    if (abilityMeta.affectHp) {
      this.log("Trying to modify enemy's HP...");
      this.combat.handleHpChange(fighter, target, abilityClass);

      // Counter-attack
      if (target.launchToCounterAttack) {
        this.log("Target ia trying to counter-attack...", {
          fighter: fighter.fighterId,
          target: target.fighterId,
        });
        if (this.combat.acceptableRange(target, fighter, ABILITY_ATTACK)) {
          this.combat.handleHpChange(target, fighter, ABILITY_ATTACK);
        }
      }
    }

    // Apply effects
    if (abilityMeta.effects.length) {
      this.combat.applyEffect(fighter, fighter, abilityClass);
    }

    this.combat.enableCooldown(fighter, abilityClass);
  }

  public handleActionCallback(timeout: boolean) {
    this.log("Emenies left", this._enemySquad.liveFighters.length);
    this.log("Aliies left", this._userSquad.liveFighters.length);

    let combatFinished = false;

    if (!this._enemySquad.liveFighters.length) {
      // Enemy loose
      this.win();
      combatFinished = true;

    } else if (!this._userSquad.liveFighters.length) {
      // User loose
      this.loose();
      combatFinished = true;
    }

    if (!combatFinished) {
      this._core.events.flush();
    }

    // Launch next unit turn
    if (!combatFinished) {
      if (timeout) {
        const self = this;
        this._aiMoveTimeout = setTimeout(function () {
          self.nextFighter();
        }, 500);
      } else {
        this.nextFighter();
      }
    }
  }

  public win(): void {
    if (this._state.mode === GAME_MODE_ADVENTURE) {
      const reward = this._core.adventures.getCurrentLevelReward();

      this._userSquad.addExp(reward.xp);
      this._core.user.modifyBalance(COMMODITY_COINS, reward.coins);
      this._core.user.modifyBalance(COMMODITY_CRYSTALS, reward.crystals);
      this.setCombatRewards(reward);

      this._core.adventures.handleLevelPassed();

    } else if (this._state.mode === GAME_MODE_DUEL) {
      this._core.user.modifyBalance(COMMODITY_CRYSTALS, DUEL_REWARDS.win.crystals);
      this.setCombatRewards({
        coins: 0,
        crystals: DUEL_REWARDS.win.crystals,
        xp: 0,
        rank: DUEL_REWARDS.win.rank
      });
      game.battleManager.updateRank(this._core.userId, 'pvp', DUEL_REWARDS.win.rank);
    }

    this.setCombatResult("win");
    this.stop();
    this._core.events.flush();
  }

  public loose(): void {
    if (this._state.mode === GAME_MODE_DUEL) {
      game.battleManager.updateRank(this._core.userId, 'pvp', DUEL_REWARDS.loose.rank);
      this._core.user.modifyBalance(COMMODITY_CRYSTALS, DUEL_REWARDS.loose.crystals);
      this.setCombatRewards({
        coins: 0,
        crystals: DUEL_REWARDS.loose.crystals,
        xp: 0,
        rank: DUEL_REWARDS.loose.rank
      });
    }

    this.setCombatResult("loose");
    this.stop();
    this._core.events.flush();
  }

  public getFighterByIndex(index: number): Fighter | null {
    return (
      _.union(this._userSquad.liveFighters, this._enemySquad.liveFighters).find(
        (unit) => unit.index === index
      ) || null
    );
  }

  public getSquadByFighter(fighter: Fighter): Fighter[] {
    if (fighter.isEnemy) {
      return this._enemySquad.liveFighters;
    } else {
      return this._userSquad.liveFighters;
    }
  }

  public getEnemySquadByFighter(fighter: Fighter): Fighter[] {
    if (fighter.isEnemy) {
      return this._userSquad.liveFighters;
    } else {
      return this._enemySquad.liveFighters;
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

  public setActiveFighter(fighterId: string | null): void {
    this._state.initiativeRating.forEach((entry) => {
      entry.active = false;
    });

    if (!fighterId) {
      fighterId = this._state.initiativeRating[0].fighterId;
      this._state.initiativeRating[0].active = true;
    } else {
      const index = this._state.initiativeRating.findIndex(
        (entry) => entry.fighterId === fighterId
      );
      this._state.initiativeRating[index].active = true;
    }
    this._core.events.initiativeRating(this._state.initiativeRating);

    //this.log("Initiative rating", this._state.initiativeRating);

    this.setActiveFighterId(fighterId);
  }

  public setActiveFighterId(fighterId: string | null): void {
    this._state.combat.activeFighterId = fighterId;
    this._core.events.activeFighterId(fighterId);
  }

  public setCombatRewards(rewards: BattleCombatRewards): void {
    this._state.combat.rewards = rewards;
    this._core.events.combatRewards(rewards);
  }

  protected getNextFighterId(): string | null {
    let fighterId = null;
    const index = this._state.initiativeRating.findIndex(
      (entry) => entry.active === true
    );
    if (this._state.initiativeRating[index + 1]) {
      fighterId = this._state.initiativeRating[index + 1].fighterId;
    } else {
      fighterId = null;
    }
    return fighterId;
  }

  public skip(): void {
    this.nextFighter();
  }

  public exit(result?: null | string): void {
    clearTimeout(this._aiMoveTimeout);

    this.setMode(null);
    this.setCombatStarted(false);
    this.setActiveFighterId(null);
    this.setMoveCells([]);
    this.setAttackCells([]);
    this.setTargetCells([]);
    this.setCombatResult(result || null);
    this.setCombatRewards({
      coins: 0,
      crystals: 0,
      xp: 0,
      rank: 0
    });

    this._state.enemySquad = this._enemySquad.getInitialState();
    this._state.initiativeRating = [];

    this._core.events.enemySquad(this._state.enemySquad);
    this._core.events.initiativeRating([]);
    this._core.adventures.setLevel(null, null);

    this.log("Exit");
  }

  public stop() {
    clearTimeout(this._aiMoveTimeout);

    this.setActiveFighterId(null);
    this.setMoveCells([]);
    this.setAttackCells([]);
    this.setTargetCells([]);
  }
}
