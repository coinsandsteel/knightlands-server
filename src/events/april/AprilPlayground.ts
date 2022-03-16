import _ from "lodash";
import { AprilDamage } from "./AprilDamage";
import { AprilEvents } from "./AprilEvents";
import { AprilMap } from "./AprilMap";
import { AprilPlaygroundState, AprilUnitBlueprint } from "./types";
import { Hero } from "./units/Hero";
import { Unit } from "./units/Unit";
import * as april from "../../knightlands-shared/april";
import errors from "../../knightlands-shared/errors";

export class AprilPlayground {
  protected _state: AprilPlaygroundState;
  protected _map: AprilMap;
  protected _units: Unit[] = [];
  protected _hero: Hero;
  protected _damage: AprilDamage;
  
  get events(): AprilEvents {
    return this._map.events;
  }
  
  get units(): Unit[] {
    return this._units;
  }
  
  get hero(): Hero {
    return this._hero;
  }
  
  get damage(): AprilDamage {
    return this._damage;
  }
  
  constructor(state: AprilPlaygroundState|null, map: AprilMap) {
    this._map = map;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }

  public setInitialState() {
    this._state = {
      units: [],
      damage: []
    } as AprilPlaygroundState;
  }
  
  public getState(): AprilPlaygroundState {
    return this._state;
  }
  
  public wakeUp(state: AprilPlaygroundState) {
    this._state.damage = state.damage;
    this._state.units = state.units;
    this.createUnits();
  }

  // TODO implement
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

  public startSession() {
    this.spawnUnits();
    this.fillDamageMap();
  }
  
  // TODO implement
  protected spawnUnits(): void {
    // Spawn enemies according to level
    this._units = [];
    this._state.units = this.units.map(unit => unit.serialize());
    this.events.units(this._state.units);
  }
  
  // TODO implement
  protected fillDamageMap(): void {
    // Fill damage map according to enemies classes and positions
    this._state.damage = [];
    this.events.damage(this._state.damage);
  }
  
  public createHero(): void {
    if (this._hero) {
      return;
    }
    this._hero = this.makeUnit({ id: null, unitClass: april.UNIT_CLASS_HERO, index: 22 }) as Hero;
  }
  
  public makeUnit(unit: AprilUnitBlueprint): Unit
  {
    let unitInstance = null;
    switch (unit.unitClass) {
      case april.UNIT_CLASS_HERO:{
        unitInstance = new Hero(unit, this._map);
        break;
      }
      case april.UNIT_CLASS_BOSS:
      case april.UNIT_CLASS_HARLEQUIN:
      case april.UNIT_CLASS_JACK:
      case april.UNIT_CLASS_CLOWN:
      case april.UNIT_CLASS_TEETH:{
        unitInstance = new Unit(unit, this._map);
        break;
      }
    }

    return unitInstance;
  }

  // TODO implement
  public allEnemiesKilled(): boolean  {
    return false;
  }

  // TODO implement
  public canMoveTo(cardId: string, index: number): boolean  {
    return true;
  }

  // TODO implement
  public moveHero(cardId: string, index: number) {
    // Decide if hero can go there depending on card class
    // Also, Hero is not allowed to attack boss if minions are alive
    // const canKillBoss = all the enemies are dead except the boss
    if (!this.canMoveTo(cardId, index)) {
      throw errors.IncorrectArguments;
    }

    // Update hero index
    // Handle kill if there's an enemy
    // if (boss) {
      // Boss killed
      // Provide bonus??? Check the doc.
      // return
    // }
    // Enemy killed
    // Update damage map (no enemy = no damage around)
    // Spawn more enemies if a box was killed
  }

  // TODO implement
  public heroDied(): boolean {
    return false;
  }

  // TODO implement
  public moveEnemies() {
    // Re-calc enemies positions
    // Update enemies positions
    // Update damage map (enemy moved = damage zone moved). Boss runs a damage sequence.
  }

  // TODO implement
  public handleDamage(): void {
    // Handle damage if hero is on a damage spot:
    // this._map.modifyHp(-value);

    // Game over if dead
  }
  
  // TODO implement
  protected moveUnitTo(unit: Unit, index: number): void {
    
  }
  
  // TODO implement
  public bossKilled(): void {
    
  }
  
  // TODO implement
  public gameOver(): void {

  }
  
  public exit() {
    this._units = [];
    this._state.units = [];
    this.events.units([]);
    
    this._state.damage = [];
    this.events.damage([]);
  }
}