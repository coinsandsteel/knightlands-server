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
  protected _paladinHp: number;
  
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
      maxHp: 0,
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

  get heroClass(): string {
    return this._state.heroClass;
  }

  public init() {
    this.wakeUp(this._state);
  }

  public restart(heroClass: string) {
    this._state.heroClass = heroClass;

    this._state.level = 1;
    this._events.level(1);

    this._state.hp = 3;
    this._state.maxHp = 3;
    this._events.hp(this._state.hp);

    this._croupier.resetFullDeck();
    this.enterLevel();
  }

  public enterLevel(booster?: string) {
    console.log("");
    console.log("");
    console.log("🚀🚀🚀 GAME STARTED 🚀🚀🚀", { 
      heroClass: this._state.heroClass
    });
    
    
    if (this._state.sessionResult === april.SESSION_RESULT_SUCCESS) {
      this._state.level++;
      this._events.level(this._state.level);
    }
    
    this.sessionResult(null);
    
    this._state.actionPoints = 2; // TODO verify this value
    this._events.actionPoints(this._state.actionPoints);
    
    // ##### Stat #####
    // TODO is there a limit of HP?
    if (this._state.level > 1 && booster === april.BOOSTER_HP) {
      this.upgradeHp();
    }

    // ##### Subsystems #####
    this._playground.startSession();
    this._croupier.startSession(booster === april.BOOSTER_CARD);
  }
  
  protected upgradeHp(): void {
    this._state.maxHp++;
    this._state.hp = this._state.maxHp;
    this._events.hp(this._state.hp);
  }
  
  public move(cardId: string, index: number): void {
    this.backupState();

    const validMove = this._playground.moveHero(cardId, index);
    if (!validMove) {
      return;
    }

    if (this._playground.allEnemiesKilled(true)) {
      this._croupier.proposeNewCard();
      this.sessionResult(april.SESSION_RESULT_SUCCESS);
      return;
    }
    
    this._croupier.heroMoveCallback(cardId);
    this.spendActionPoint();
    
    if (this._state.actionPoints === 0) {
      this.moveEnded();
    }
  }
  
  public sessionResult(result: string): void {
    this._state.sessionResult = result;
    this._events.sessionResult(result);
  }
  
  public skip(): void {
    this.moveEnded();
  }

  public moveEnded(): void {
    const damage = this._playground.handleDamage();
    if (
      this.heroClass === april.HERO_CLASS_PALADIN
      &&
      !damage
      &&
      !this._playground.enemyWasKilled
    ) {
      this.modifyHp(1);
    }

    if (this._state.hp <= 0) {
      this.sessionResult(april.SESSION_RESULT_FAIL);
      return;
    }
    
    this._playground.resetKillTracker();
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
    this._state.maxHp = state.maxHp;
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
    if (this._state.hp > this._state.maxHp) {
      this._state.hp = this._state.maxHp;
    }
    this._events.hp(this._state.hp);
  };
  
  public exit() {
    this._state.level = 1;
    this._events.level(1);
    
    this.sessionResult(null);
    
    this._state.hp = 3;
    this._state.maxHp = 3;
    this._events.hp(3);
    
    this._state.actionPoints = 2;
    this._events.actionPoints(2);

    this._croupier.exit();
    this._playground.exit();
  }
}