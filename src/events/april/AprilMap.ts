import _ from "lodash";

import * as april from "../../knightlands-shared/april";
import errors from "../../knightlands-shared/errors";
import User from "../../user";

import { AprilMapState } from "./types";
import { AprilEvents } from "./AprilEvents";
import { AprilUser } from "./AprilUser";
import { AprilPlayground } from "./AprilPlayground";
import { AprilCroupier } from "./AprilCroupier";
import { AprilMovement } from "./AprilMovement";
import { Card } from "./units/Card";

export class AprilMap {
  protected _state: AprilMapState;
  protected _statePrevious: AprilMapState|null;
  protected _events: AprilEvents;
  protected _user: User;
  protected _aprilUser: AprilUser;
  protected _croupier: AprilCroupier;
  protected _playground: AprilPlayground;
  protected _movement: AprilMovement;
  
  constructor(state: AprilMapState | null, events: AprilEvents, aprilUser: AprilUser, user: User) {
    this._events = events;
    this._user = user;
    this._aprilUser = aprilUser;

    this._playground = new AprilPlayground(state ? state.playground : null, this);
    this._croupier = new AprilCroupier(state ? state.croupier : null, this);

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }

    this._statePrevious = null;
    this._movement = new AprilMovement(this);
  }

  public setInitialState() {
    const playgroundState = this._playground.getState();
    const croupierState = this._croupier.getState();

    this._state = {
      heroClass: april.HERO_CLASS_KNIGHT,
      level: 1,
      hp: 0,
      actionPoints: 0,
      sessionResult: null,
      prices: {
        thirdAction: 0,
        resurrection: 0
      },
      boosterCounters: {
        thirdAction: 0,
        resurrection: 0
      },
      playground: playgroundState,
      croupier: croupierState
    } as AprilMapState;

    this._state.prices.thirdAction = this.getThirdActionPrice();
    this._state.prices.resurrection = this.getResurrectionPrice();
  }

  public getState(): AprilMapState {
    return this._state;
  }
  
  get events(): AprilEvents {
    return this._events;
  }

  get aprilUser(): AprilUser {
    return this._aprilUser;
  }

  get playground(): AprilPlayground {
    return this._playground;
  }

  get croupier(): AprilCroupier {
    return this._croupier;
  }

  get movement(): AprilMovement {
    return this._movement;
  }

  get deck(): Card[] {
    return this._croupier.deck;
  }

  public init() {
    this.wakeUp(this._state);
  }

  public restart(heroClass: string) {
    this._state.heroClass = heroClass;

    this._state.level = 1;
    this._events.level(1);

    this._state.hp = this.getInitialHp();
    this._events.hp(this._state.hp);

    this.enterLevel();
  }

  public enterLevel(booster?: string) {
    console.log("");
    console.log("");
    console.log("🚀🚀🚀 GAME STARTED 🚀🚀🚀", { 
      heroClass: this._state.heroClass
    });
    
    // ##### Stat #####
    this.handleBooster(booster);
    
    this._state.sessionResult = null;
    this._events.sessionResult(null);
    
    this._state.actionPoints = 2; // TODO verify this value
    this._events.actionPoints(this._state.actionPoints);

    // ##### Subsystems #####
    this._playground.startSession();
    this._croupier.startSession();
  }
  
  // TODO implement
  protected handleBooster(booster: string): void {
    // Verify class and level
    // Add hp or card
  }
  
  // TODO implement
  protected getInitialHp(): number {
    // TODO calc according to the balance table
    return 3;
  }

  public move(cardId: string, index: number): void {
    this.backupState();

    const validMove = this._playground.moveHero(cardId, index);
    if (!validMove) {
      return;
    }
    this._croupier.cardUsed(cardId);
    this.spendActionPoint();
    
    if (this._state.actionPoints === 0) {
      this.moveEnded();
    }
  }
  
  public sessionEnd(result: string): void {
    this._state.sessionResult = result;
    this._events.sessionResult(result);
  }
  
  public skip(): void {
    this.moveEnded();
  }

  public moveEnded(): void {
    this._playground.handleDamage();

    if (this._state.hp <= 0) {
      this.sessionEnd(april.SESSION_RESULT_FAIL);
      return;
    }
    
    if (this._playground.allEnemiesKilled()) {
      this.sessionEnd(april.SESSION_RESULT_SUCCESS);
      this._state.level++;
      this._events.level(this._state.level);
      return;
    }
    
    this._playground.moveEnemies();
    this._croupier.respawnCards();
    this.resetActionPoints();
  }
  
  protected spendActionPoint(): void {
    this._state.actionPoints--;
    this._events.actionPoints(this._state.actionPoints);
  }
  
  protected resetActionPoints(): void {
    this._state.actionPoints = 2;
    this._events.actionPoints(2);
  }
  
  public wakeUp(state: AprilMapState) {
    this._state.heroClass = state.heroClass;
    this._state.level = state.level;
    this._state.sessionResult = state.sessionResult;
    this._state.hp = state.hp;
    this._state.actionPoints = state.actionPoints;

    this._playground.wakeUp(state.playground);
    this._croupier.wakeUp(state.croupier);
  }

  protected getThirdActionPrice(): number {
    return 100 * (this._state.boosterCounters.thirdAction + 1);
  }

  protected getResurrectionPrice(): number {
    return 1000;
  }

  public purchaseAction() {
    if (this._state.actionPoints > 2) {
      throw errors.IncorrectArguments;
    }

    const price = this.getThirdActionPrice();
    if (this._aprilUser.gold < price) {
      throw errors.NotEnoughCurrency;
    }

    this._aprilUser.modifyBalance(april.CURRENCY_GOLD, -price);

    this._state.actionPoints++;
    this._state.boosterCounters.thirdAction++;

    this._events.actionPoints(this._state.actionPoints);
  }

  public backupState(): void {
    this._statePrevious = _.cloneDeep(this._state);
  }

  public resurrect(): void {
    this._state = _.cloneDeep(this._statePrevious);
  }

  public modifyHp(value: number): void {
    this._state.hp += value;
    if (this._state.hp < 0) {
      this._state.hp = 0;
    }
    this._events.hp(this._state.hp);
  };
  
  public exit() {
    this._state.level = 1;
    this._events.level(1);
    
    this._state.sessionResult = null;
    this._events.sessionResult(null);
    
    this._state.hp = 3;
    this._events.hp(3);
    
    this._state.actionPoints = 2;
    this._events.actionPoints(2);

    this._croupier.exit();
    this._playground.exit();
  }
}