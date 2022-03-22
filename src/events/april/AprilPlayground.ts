import _ from "lodash";
import { AprilDamage } from "./AprilDamage";
import { AprilEvents } from "./AprilEvents";
import { AprilMap } from "./AprilMap";
import { AprilPlaygroundState, AprilUnitBlueprint } from "./types";
import { Hero } from "./units/Hero";
import { Unit } from "./units/Unit";
import * as april from "../../knightlands-shared/april";

export class AprilPlayground {
  protected _state: AprilPlaygroundState;
  protected _map: AprilMap;
  protected _units: Unit[] = [];
  protected _damage: AprilDamage;
  
  get events(): AprilEvents {
    return this._map.events;
  }
  
  get units(): Unit[] {
    return this._units;
  }
  
  get hero(): Hero {
    return this._units.find((unit: Unit) => unit.unitClass === april.UNIT_CLASS_HERO);
  }
  
  get damage(): AprilDamage {
    return this._damage;
  }
  
  get enemyWasKilled(): boolean {
    return this._state.enemyWasKilled;
  }
  
  constructor(state: AprilPlaygroundState|null, map: AprilMap) {
    this._map = map;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }

    this._damage = new AprilDamage(map);
  }

  public setInitialState() {
    this._state = {
      enemyWasKilled: false,
      units: [],
      damage: []
    } as AprilPlaygroundState;
  }
  
  public getState(): AprilPlaygroundState {
    return this._state;
  }
  
  public wakeUp(state: AprilPlaygroundState) {
    this._state.enemyWasKilled = state.enemyWasKilled;
    this._state.damage = state.damage;
    this._state.units = state.units;
    this.createUnits();
  }

  protected createUnits(): void {
    this._units = [];
    this._state.units.forEach((unit: AprilUnitBlueprint) => {
      this._units.push(
        this.makeUnit(unit)
      );
    });
  }

  public startSession() {
    this._state.enemyWasKilled = false;
    this.spawnUnits();
    this.updateDamageMap();
  }
  
  // TODO implement
  protected spawnUnits(): void {
    const demoUnits = [
      { unitClass: april.UNIT_CLASS_TEETH, index: 0 },
      { unitClass: april.UNIT_CLASS_CLOWN, index: 3 },
      { unitClass: april.UNIT_CLASS_JACK, index: 6 },
      { unitClass: april.UNIT_CLASS_HARLEQUIN, index: 12 },
      //{ unitClass: april.UNIT_CLASS_BOSS, index: 12 },
      { unitClass: april.UNIT_CLASS_HERO, index: 22 },
    ];

    // Spawn enemies according to level
    this._units = demoUnits.map((entry): Unit => {
      return this.makeUnit({ id: null, ...entry });
    });

    this.commitUnits();
  }
  
  protected updateDamageMap(): void {
    this._state.damage = this._damage.getDamageMap(this._units);
    this.events.damage(this._state.damage);
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

  public allEnemiesKilled(includingBoss: boolean): boolean  {
    const unitsLast = this._units.filter(
      unit => unit.unitClass !== april.UNIT_CLASS_HERO && (includingBoss || unit.unitClass !== april.UNIT_CLASS_BOSS)
    );
    return !unitsLast.length;
  }

  public resetKillTracker() {
    this._state.enemyWasKilled = false;
  }

  public moveHero(cardId: string, index: number): boolean {
    // Hero is not allowed to attack boss if minions are alive
    const enemyOnTheSpot = this.findUnitByIndex(index);
    if (
      enemyOnTheSpot 
      && 
      enemyOnTheSpot.unitClass === april.UNIT_CLASS_BOSS
      &&
      !this.allEnemiesKilled(false)
    ) {
      return false;
    }

    // Update hero index
    this.hero.move(index);

    // Enemy killed
    if (enemyOnTheSpot) {
      // Spawn more enemies if a box was killed
      this.killEnemy(enemyOnTheSpot);
      // Update damage map (no enemy = no damage around)
      this.updateDamageMap();
      this._state.enemyWasKilled = false;
    }

    this.commitUnits();
    
    return true;
  }

  // TODO implement
  public heroDied(): boolean {
    return false;
  }

  // TODO implement
  public moveEnemies() {
    // Re-calc enemies positions
    // Update enemies positions
    this._units.forEach((unit) => {
      if (
        unit.unitClass !== april.UNIT_CLASS_HERO
        &&
        unit.unitClass !== april.UNIT_CLASS_BOSS
      ) {
        unit.move();
      }
    });

    // Update damage map (enemy moved = damage zone moved). Boss runs a damage sequence.
    this.updateDamageMap();
    this.commitUnits();

    this._units.forEach((unit) => {
      if (unit.unitClass === april.UNIT_CLASS_BOSS) {
        unit.switchSequence();
      }
    });
  }

  public handleDamage(): number {
    // Handle damage if hero is on a damage spot:
    const dmgValue = this._state.damage[this.hero.index];
    this._map.modifyHp(-dmgValue);
    return dmgValue;
  }
  
  public exit() {
    this._units = [];
    this._state.units = [];
    this.events.units([]);
    
    this._state.damage = [];
    this.events.damage([]);
  }

  protected killEnemy(enemy: Unit): void {
    // Spawn 1-4 clowns
    if (enemy.unitClass === april.UNIT_CLASS_JACK) {
      const nextEnemiesRelativeMap = [
        [-1, -1],
        [-1,  1],
        [ 1, -1],
        [ 1,  1],
      ];
      const nextEnemiesIndexes = this._map.movement.getVisibleIndexes(enemy.index, nextEnemiesRelativeMap);
      const nextEnemies = nextEnemiesIndexes.map(index => this.makeUnit({
        id: null, unitClass: april.UNIT_CLASS_CLOWN, index 
      }));
      this._units.push(...nextEnemies);
    }
    this._units = this.units.filter((unit) => unit.index !== enemy.index || unit.unitClass === april.UNIT_CLASS_HERO);
    this._map.aprilUser.updateHeroScore(this._map.heroClass, 1);
  }

  public findUnitByIndex(index: number): Unit|undefined {
    return this.units.find((unit) => unit.index === index);
  }

  protected commitUnits(): void {
    this._state.units = this.units.map(unit => unit.serialize());
    this.events.units(this._state.units);
  }

  public getBusyIndexes() {
    return this._units.map(unit => unit.index);
  }
}