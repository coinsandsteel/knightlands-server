import _ from "lodash";

import * as april from "../../knightlands-shared/april";
import errors from "../../knightlands-shared/errors";
import User from "../../user";
import game from "../../game";

import { AprilMapState } from "./types";
import { AprilEvents } from "./AprilEvents";
import { AprilUser } from "./AprilUser";
import { AprilPlayground } from "./AprilPlayground";
import { AprilCroupier } from "./AprilCroupier";
import { AprilMovement } from "./AprilMovement";

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
      healing: 0,
      healingUsed: false,
      actionPoints: 0,
      sessionResult: null,
      boosterCounters: {
        thirdAction: 0,
        resurrection: 0
      },
      playground: playgroundState,
      croupier: croupierState
    } as AprilMapState;
  }

  public getState(): AprilMapState {
    this._state.playground = this._playground.getState();
    this._state.croupier = this._croupier.getState();
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

  get heroClass(): string {
    return this._state.heroClass;
  }

  get level(): number {
    return this._state.level;
  }

  public init() {
    this.wakeUp(this._state);
  }

  public restart(heroClass: string) {
    this._state.heroClass = heroClass;
    this._events.heroClass(heroClass);

    this._state.boosterCounters.thirdAction = 0;
    this._state.boosterCounters.resurrection = 0;

    this._state.level = 1;
    this._events.level(1);

    this._state.hp = 3;
    this._events.hp(3);
    
    this._state.maxHp = 3;
    this._events.maxHp(3);
    
    this._aprilUser.resetSessionGold();

    this._croupier.reset();
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
    
    this.updatePrices();
    this.resetHealing();
    this.sessionResult(null);

    this._state.actionPoints = 2;
    this._events.actionPoints(this._state.actionPoints);
    
    // ##### Stat #####
    if (this._state.level > 1 && booster === april.BOOSTER_HP) {
      this.modifyHp(1);
      this.modifyMaxHp(1);
    }

    // ##### Subsystems #####
    this._playground.enterLevel();
    this._croupier.enterLevel(booster === april.BOOSTER_CARD);
  }
  
  public move(cardId: string, index: number): void {
    this.backupState();

    const card = this._croupier.getCardById(cardId);
    if (!card || !card.hasNextCell(index)) {
      return;
    }
    
    const oldHeroIndex = this._playground.hero.index;
    console.log('[Move start]', { oldHeroIndex, newHeroIndex: index});
    const validMove = this._playground.moveHero(index);
    if (!validMove) {
      return;
    }
    
    if (this._playground.allEnemiesKilled(true)) {
      this._croupier.proposeNewCard();
      this.sessionResult(april.SESSION_RESULT_SUCCESS);
      return;
    }
    
    this._croupier.heroMoveCallback(card, oldHeroIndex, index);
    this.spendActionPoint();
    
    console.log('[Move end]', { oldHeroIndex, newHeroIndex: this._playground.hero.index});
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
    if (!damage) {
      this.heal();
    }

    if (this._state.hp <= 0) {
      this.sessionResult(april.SESSION_RESULT_FAIL);
      return;
    }
    
    this._playground.moveEndedCallback();
    this._croupier.moveEndedCallback();
    this.resetActionPoints();
  }
  
  public heal(): void {
    if (
      this.heroClass === april.HERO_CLASS_PALADIN
      &&
      !this._playground.fighted
      &&
      this._state.hp < this._state.maxHp
      &&
      !this._state.healingUsed
    ) {
      this._state.healing++;
      this._events.healing(this._state.healing);
      console.log('[Map] Healing insreased', { healing: this._state.healing });
    }

    if (this._state.healing === 4) {
      this.modifyHp(1);

      this._state.healing = 0;
      this._events.healing(0);

      this._state.healingUsed = true;
      console.log('[Map] Healing used', { hp: this._state.hp });
    }
  }

  public resetHealing() {
    this._state.healingUsed = false;
    this._state.healing = 0;
    this._events.healing(0);
  }

  public spendActionPoint(): void {
    this._state.actionPoints--;
    this._events.actionPoints(this._state.actionPoints);
    console.log('[Map] -1 action point: ', this._state.actionPoints);
  }
  
  public addActionPoint(): void {
    this._state.actionPoints++;
    this._events.actionPoints(this._state.actionPoints);
    console.log('[Map] +1 action point: ', this._state.actionPoints);
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

  protected getActionPrice(): number {
    return this.level * (this._state.boosterCounters.thirdAction + 1) * game.aprilManager.actionPriceBase;
  }

  protected getResurrectionPrice(): number {
    return this.level * (this._state.boosterCounters.resurrection + 1) * game.aprilManager.resurrectionPriceBase;
  }

  public purchaseAction() {
    if (this._state.actionPoints > 2) {
      throw errors.IncorrectArguments;
    }

    const price = this.getActionPrice();
    if (this._aprilUser.gold < price) {
      throw errors.NotEnoughCurrency;
    }

    this._aprilUser.modifyBalance(april.CURRENCY_GOLD, -price);

    this._state.actionPoints++;
    this._state.boosterCounters.thirdAction++;

    this._events.actionPoints(this._state.actionPoints);
    this.updatePrices();
  }
  
  public updatePrices(): void {
    this._events.prices('thirdAction', this.getActionPrice());
    this._events.prices('resurrection', this.getResurrectionPrice());
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

  public modifyMaxHp(value: number): void {
    this._state.maxHp += value;
    this._events.maxHp(this._state.hp);
  };

  public gameOver() {
    this._aprilUser.modifyBalance(april.CURRENCY_GOLD, this._aprilUser.sessionGold);

    if (this._playground.hasVictory) {
      game.aprilManager.updateRank(
        this._user.id,
        this._state.heroClass,
        this._aprilUser.sessionGold
      );
    }
  }
  
  public exit() {
    this.gameOver();
    this._state.level = 1;
    this._events.level(1);
    
    this.sessionResult(null);
    
    this._state.hp = 3;
    this._events.hp(3);
    
    this._state.maxHp = 3;
    this._events.maxHp(3);
    
    this._state.healing = 0;
    this._events.healing(0);
    
    this._state.actionPoints = 2;
    this._events.actionPoints(2);

    this._aprilUser.resetSessionGold();

    this._croupier.exit();
    this._playground.exit();
  }
}