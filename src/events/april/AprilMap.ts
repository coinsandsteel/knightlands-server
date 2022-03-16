import _ from "lodash";

import * as april from "../../knightlands-shared/april";
import errors from "../../knightlands-shared/errors";
import User from "../../user";

import { AprilMapState, AprilUnit } from "./types";
import { AprilCroupier } from "./AprilCroupier";
import { AprilEvents } from "./AprilEvents";
import { AprilUser } from "./AprilUser";
import { AprilDamage } from "./AprilDamage";
import { AprilMover } from "./AprilMover";

import { Hero } from "./units/Hero";
import { Unit } from "./units/Unit";
import { Card } from "./units/Card";

export class AprilMap {
  protected _state: AprilMapState;
  protected _events: AprilEvents;
  protected _user: User;
  protected _aprilUser: AprilUser;
  protected _croupier: AprilCroupier;
  protected _mover: AprilMover;
  protected _damage: AprilDamage;
  
  protected _units: Unit[] = [];
  protected _cards: Card[] = [];
  protected _usedCards: Card[] = [];
  protected _hero: Hero;
  
  constructor(state: AprilMapState | null, events: AprilEvents, aprilUser: AprilUser, user: User) {
    this._events = events;
    this._user = user;
    this._aprilUser = aprilUser;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }

    this._damage = new AprilDamage(this);
    this._croupier = new AprilCroupier(this);
  }

  public setInitialState() {
    this._state = {
      heroClass: april.HERO_CLASS_KNIGHT,
      level: 1,
      sessionResult: null,
      hp: 0,
      actionPoints: 0,
      cardsInQueue: 0,
      damage: [],
      units: [],
      cards: [],
      usedCards: [],
      timesThirdActionPurchased: 0,
      canBuyThirdAction: false
    } as AprilMapState;
  }

  public getState(): AprilMapState {
    const returnState = _.cloneDeep(this._state);
    returnState.usedCards = this._state.usedCards.length;
    return returnState;
  }
  
  get events(): AprilEvents {
    return this._events;
  }

  get aprilUser(): AprilUser {
    return this._aprilUser;
  }

  get damage(): AprilDamage {
    return this._damage;
  }

  get units(): Unit[] {
    return this._units;
  }

  get cards(): Card[] {
    return this._cards;
  }

  get usedCards(): Card[] {
    return this._usedCards;
  }

  get hero(): Hero {
    return this._hero;
  }

  public init() {
    this.wakeUp(this._state);
  }

  public createHero(): void {
    if (this._hero) {
      return;
    }
    this._hero = this.makeUnit({ id: null, unitClass: april.UNIT_CLASS_HERO, index: 22 }) as Hero;
  }
  
  public makeUnit(unit: AprilUnit): Unit
  {
    let unitInstance = null;
    switch (unit.unitClass) {
      case april.UNIT_CLASS_HERO:{
        unitInstance = new Hero(unit, this);
        break;
      }
      case april.UNIT_CLASS_BOSS:
      case april.UNIT_CLASS_HARLEQUIN:
      case april.UNIT_CLASS_JACK:
      case april.UNIT_CLASS_CLOWN:
      case april.UNIT_CLASS_TEETH:{
        unitInstance = new Unit(unit, this);
        break;
      }
    }

    return unitInstance;
  }
  
  // Start the card game from scratch
  public restart(heroClass: string, booster: string) {
    //console.log("");
    //console.log("");
    //console.log("🚀🚀🚀 GAME STARTED 🚀🚀🚀", { petClass, level, boosters });
    
    this._croupier.reset();

    this._state.heroClass = heroClass;
    this.handleBooster(booster);
    
    this._state.sessionResult = null;
    this._events.sessionResult(null);
    
    // TODO calc initial hp
    this._state.hp = 1;
    this._events.hp(this._state.hp);
    
    // TODO verify
    this._state.actionPoints = 2;
    this._events.actionPoints(this._state.actionPoints);
    
    // TODO verify
    this._state.cardsInQueue = 5;
    this._events.cardsInQueue(this._state.cardsInQueue);
    
    this._state.usedCards = [];
    this._events.usedCards(this._state.usedCards.length);
    
    // TODO create damage map
    this.spawnDamageMap();
    this._state.damage = [];
    this._events.damage(this._state.damage);
    
    // TODO implement
    this.spawnUnits();
    this._events.units(
      this.units.map(unit => unit.serialize())
    );

    // TODO implement
    this.spawnCards();
    this._events.cards(
      this.cards.map(card => card.serialize())
    );
  }
  
  protected handleBooster(booster: string): void {

  }

  protected spawnDamageMap(): void {

  }

  protected spawnUnits(): void {

  }

  protected spawnCards(): void {

  }

  public exit() {
    this._croupier.reset();

    // TODO reset boosters effects
    this._state.sessionResult = null;
    this._events.sessionResult(null);
    
    this._state.hp = 3;
    this._events.hp(this._state.hp);
    
    this._state.actionPoints = 2;
    this._events.actionPoints(this._state.actionPoints);
    
    this._state.cardsInQueue = 0;
    this._events.cardsInQueue(this._state.cardsInQueue);
    
    this._units = [];
    this._state.units = [];
    this._events.units([]);
    
    this._cards = [];
    this._state.cards = [];
    this._events.cards([]);

    this._usedCards = [];
    this._state.usedCards = [];
    this._events.usedCards(this._state.usedCards.length);
    
    this.damage.reset();
    this._state.damage = [];
    this._events.damage(this._state.damage);
  }

  public wakeUp(state: AprilMapState) {
    this._state.heroClass = state.heroClass;
    this._state.hp = state.hp;
    this._state.level = state.level;
    this._state.actionPoints = state.actionPoints;
    this._state.cardsInQueue = state.cardsInQueue;
    this._state.damage = state.damage;
    this._state.units = state.units;
    this._state.cards = state.cards;
    this._state.usedCards = state.usedCards;

    this.createUnits();
  }

  // TODO construct units
  protected createUnits(): void {
    // this._units
    // this._hero
    // this._cards
    // this._usedCards

    /*cards.forEach((card: MarchCard, index: number) => {
      let newUnit = this.makeUnit(card);
      if (newUnit instanceof Pet) {
        this._pet = this.makeUnit(card) as Pet;
      }
      this.setCardByIndex(newUnit, index);
    });*/
  }

  public handleDamage(): void {
    // Choose cards to attack/heal
    /*const victims = this._damage.getVictims(attacker, direction);
    this._events.effect(
      attacker.unitClass,
      attacker.index,
      victims.map(victim => victim.index)
    );
    
    // Modify HP
    victims.forEach(victim => {
      const currentHpModifier = this._damage.getHpModifier(attacker, victim);
      victim.modifyHp(currentHpModifier);
      //console.log('Damage', { _id: victim.id, unitClass: victim.unitClass, hp: victim.hp, delta: currentHpModifier });
    })*/
  }

  public gameOver(): void {
    /*this._marchUser.voidBoosters();
    this._marchUser.flushStats(this.pet);
    this._marchCroupier.reset();*/
  }

  public bossKilled(): void {
    /*this._state.stat.bossesKilled++;
    this._events.stat(this._state.stat);*/
  }

  public purchaseThirdAction() {
    if (this._state.actionPoints === 3 || !this._state.canBuyThirdAction) {
      throw errors.IncorrectArguments;
    }

    // TODO: Use correct formula to calculate price
    const price = (this._state.timesThirdActionPurchased + 1) * 100;
    if (this._aprilUser.gold < price) {
      throw errors.NotEnoughCurrency;
    }

    this._aprilUser.modifyBalance(april.CURRENCY_GOLD, -price);
    this._state.canBuyThirdAction = false;
    this._state.actionPoints++;
    this._state.timesThirdActionPurchased++;
    this._events.actionPoints(this._state.actionPoints);
  }
}