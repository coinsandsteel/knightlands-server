import _ from "lodash";
import { AprilDamage } from "./AprilDamage";
import { AprilEvents } from "./AprilEvents";
import { AprilMap } from "./AprilMap";
import { AprilPlaygroundState, AprilUnitBlueprint } from "./types";
import { Hero } from "./units/Hero";
import { Unit } from "./units/Unit";
import * as april from "../../knightlands-shared/april";

const LEVELS = [
  // Level 1
  [
    { t: 1, c: 1, indexes: [6, 12] }
  ],
  // Level 2
  [
    { t: 0, c: 3 },
    { t: 3, c: 0 },
    { t: 1, c: 2 },
    { t: 2, c: 1 },
  ],
  // Level 3
  [
    { t: 1, c: 1, j: 1 },
    { t: 0, c: 2, j: 1 },
    { t: 2, c: 0, j: 1 },
  ],
  // Level 4
  [
    { t: 1, c: 1, j: 2, h: 0 },
    { t: 2, c: 0, j: 2, h: 0 },
    { t: 0, c: 2, j: 2, h: 0 },
    { t: 1, c: 1, j: 1, h: 1 },
    { t: 2, c: 0, j: 1, h: 1 },
    { t: 0, c: 2, j: 1, h: 1 },
    { t: 0, c: 2, j: 0, h: 2 },
    { t: 2, c: 0, j: 0, h: 2 },
    { t: 1, c: 1, j: 0, h: 2 },
  ],
  // Level 5
  [
    { t: 2, c: 0, j: 2, h: 1 },
    { t: 0, c: 2, j: 2, h: 1 },
    { t: 2, c: 0, j: 3, h: 0 },
    { t: 0, c: 2, j: 3, h: 0 },
    { t: 2, c: 0, j: 0, h: 3 },
    { t: 0, c: 2, j: 0, h: 3 },
    { t: 0, c: 2, j: 1, h: 2 },
    { t: 2, c: 0, j: 1, h: 2 },
  ],
  // Level 6
  [
    { t: 2, c: 1, j: 2, h: 1 },
    { t: 1, c: 2, j: 2, h: 1 },
    { t: 2, c: 1, j: 3, h: 0 },
    { t: 1, c: 2, j: 3, h: 0 },
    { t: 2, c: 1, j: 0, h: 3 },
    { t: 1, c: 2, j: 0, h: 3 },
    { t: 1, c: 2, j: 1, h: 2 },
    { t: 2, c: 1, j: 1, h: 2 },
    { t: 0, c: 3, j: 2, h: 1 },
    { t: 3, c: 0, j: 2, h: 1 },
    { t: 3, c: 0, j: 3, h: 0 },
    { t: 0, c: 3, j: 3, h: 0 },
    { t: 3, c: 0, j: 0, h: 3 },
    { t: 0, c: 3, j: 0, h: 3 },
    { t: 0, c: 3, j: 1, h: 2 },
    { t: 3, c: 0, j: 1, h: 2 },
  ],
  // Level 7
  [
    { t: 2, c: 2, j: 2, h: 1 },
    { t: 2, c: 2, j: 1, h: 2 },
    { t: 3, c: 1, j: 2, h: 1 },
    { t: 1, c: 3, j: 2, h: 1 },
    { t: 3, c: 1, j: 1, h: 2 },
    { t: 1, c: 3, j: 1, h: 2 },
    { t: 4, c: 0, j: 2, h: 1 },
    { t: 4, c: 0, j: 1, h: 2 },
    { t: 0, c: 4, j: 2, h: 1 },
    { t: 0, c: 4, j: 1, h: 2 },
    { t: 0, c: 4, j: 3, h: 0 },
    { t: 4, c: 0, j: 3, h: 0 },
    { t: 3, c: 1, j: 3, h: 0 },
    { t: 2, c: 2, j: 3, h: 0 },
    { t: 1, c: 3, j: 3, h: 0 },
    { t: 3, c: 1, j: 0, h: 3 },
    { t: 2, c: 2, j: 0, h: 3 },
    { t: 1, c: 3, j: 0, h: 3 },
    { t: 0, c: 4, j: 0, h: 3 },
    { t: 4, c: 0, j: 0, h: 3 },
  ],
  // Level 8
  [
    { t: 4, c: 0, j: 0, h: 4 },
    { t: 3, c: 1, j: 0, h: 4 },
    { t: 2, c: 2, j: 0, h: 4 },
    { t: 1, c: 3, j: 0, h: 4 },
    { t: 0, c: 4, j: 0, h: 4 },
    { t: 4, c: 0, j: 4, h: 0 },
    { t: 3, c: 1, j: 4, h: 0 },
    { t: 2, c: 2, j: 4, h: 0 },
    { t: 1, c: 3, j: 4, h: 0 },
    { t: 0, c: 4, j: 4, h: 0 },
    { t: 4, c: 0, j: 2, h: 2 },
    { t: 3, c: 1, j: 2, h: 2 },
    { t: 2, c: 2, j: 2, h: 2 },
    { t: 1, c: 3, j: 2, h: 2 },
    { t: 0, c: 4, j: 2, h: 2 },
    { t: 0, c: 4, j: 1, h: 3 },
    { t: 1, c: 3, j: 1, h: 3 },
    { t: 2, c: 2, j: 1, h: 3 },
    { t: 3, c: 1, j: 1, h: 3 },
    { t: 4, c: 0, j: 1, h: 3 },
    { t: 0, c: 4, j: 3, h: 1 },
    { t: 1, c: 3, j: 3, h: 1 },
    { t: 2, c: 2, j: 3, h: 1 },
    { t: 3, c: 1, j: 3, h: 1 },
    { t: 4, c: 0, j: 3, h: 1 },
  ],
  // Level 9
  [
    { j: 2, h: 2, b: 1 },
  ],
];

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
  
  get fighted(): boolean {
    return this._state.fighted;
  }

  get enemiesKilled(): number {
    return this._state.enemiesKilled;
  }

  get hasVictory(): boolean {
    return this._state.hasVictory;
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
      enemiesKilled: 0,
      fighted: false,
      hasVictory: false,
      units: [],
      damage: []
    } as AprilPlaygroundState;
  }
  
  public getState(): AprilPlaygroundState {
    return this._state;
  }
  
  public wakeUp(state: AprilPlaygroundState) {
    this._state.enemiesKilled = state.enemiesKilled;
    this._state.fighted = state.fighted;
    this._state.damage = state.damage;
    this._state.units = state.units;
    this._state.hasVictory = state.hasVictory;
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

  public enterLevel() {
    this._state.enemiesKilled = 0;
    this._state.fighted = false;
    this.spawnUnits();
    this.updateDamageMap();
  }
  
  protected spawnUnits(): void {
    this._units = [];
    const levelPool = _.cloneDeep(_.sample(LEVELS[this._map.level - 1]));
    
    let indexes = _.shuffle(
      levelPool.indexes 
      ||
      Array.from({ length: 25 }, (_, i) => i)
      )
      .filter(index => index !== 22 && (!levelPool.b || index !== 12));
      
    //console.log('[Spawn pool]', levelPool);

    for (let index in levelPool) {
      let quantity = levelPool[index];
      let unitClass = {
        t: april.UNIT_CLASS_TEETH,
        c: april.UNIT_CLASS_CLOWN,
        j: april.UNIT_CLASS_JACK,
        h: april.UNIT_CLASS_HARLEQUIN,
        b: april.UNIT_CLASS_BOSS,
      }[index];

      if (!unitClass) {
        continue;
      }

      //console.log('[Spawn class]', { unitClass, quantity });
      
      for (let i = 0; i < quantity; i++) {
        let unitIndex = unitClass === april.UNIT_CLASS_BOSS ? 12 : indexes.pop();
        let unit = this.makeUnit({ 
          id: null, 
          unitClass, 
          index: unitIndex,
          isDead: false
        });
        //console.log('[Spawn unit]', unit.serialize());
        this._units.push(unit);
      }
    }

    this._units.push(
      this.makeUnit({ 
        id: null, 
        unitClass: april.UNIT_CLASS_HERO, 
        index: 22,
        isDead: false
      })
    );

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
      case april.UNIT_CLASS_HERO:
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
      unit => {
        return (
          unit.unitClass !== april.UNIT_CLASS_HERO 
          && 
          (includingBoss || unit.unitClass !== april.UNIT_CLASS_BOSS)
          &&
          !unit.isDead
        );
      }
    );
    return !unitsLast.length;
  }

  public moveEndedCallback(): void {
    this.removeDeadUnits();
    this.resetKillTracker();
    this.moveEnemies();
  }

  public removeDeadUnits(): void {
    this._units = this._units.filter(unit => !unit.isDead);
  }

  public resetKillTracker(): void {
    this._state.fighted = false;
  }

  public moveHero(index: number): boolean {
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
    }

    this.commitUnits();
    
    return true;
  }

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

    this._units.forEach((unit) => {
      if (unit.unitClass === april.UNIT_CLASS_BOSS) {
        unit.switchSequence();
      }
    });
    
    // Update damage map (enemy moved = damage zone moved). Boss runs a damage sequence.
    this.updateDamageMap();
    this.commitUnits();
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
      const nextEnemiesIndexes = this._map.movement.getCornerPositions(enemy.index);
      const nextEnemies = nextEnemiesIndexes.map(index => this.makeUnit({
        id: null,
        unitClass: april.UNIT_CLASS_CLOWN,
        index,
        isDead: false
      }));
      this._units.push(...nextEnemies);
    }

    // TODO check if it works
    enemy.kill();

    this.updateSessionGoldAndScoreByUnitClass(enemy.unitClass);
    if (enemy.unitClass === april.UNIT_CLASS_BOSS) {
      this._state.hasVictory = true;
    }

    this._state.fighted = true;
    this._state.enemiesKilled++;

    
  }

  private updateSessionGoldAndScoreByUnitClass(unitClass: string) {
    let goldScore = 0;
    switch(unitClass) {
      case april.UNIT_CLASS_TEETH:
      case april.UNIT_CLASS_CLOWN:
        goldScore = 1;
        break;
      case april.UNIT_CLASS_JACK:
      case april.UNIT_CLASS_HARLEQUIN:
        goldScore = 2;
        break;
      case april.UNIT_CLASS_BOSS:
        goldScore = 10;
        break;
      default:
        goldScore = 0;
        break;
    }
    this._map.aprilUser.addSessionGold(goldScore);
    this._map.aprilUser.updateHeroScore(this._map.heroClass, goldScore);
  }

  public findUnitByIndex(index: number): Unit|undefined {
    return this.units.find((unit) => unit.index === index);
  }

  protected commitUnits(): void {
    this._state.units = this.units
      .filter(unit => !unit.isDead)
      .map(unit => unit.serialize());
    this.events.units(this._state.units);
  }

  public getBusyIndexes() {
    return this._units
      .filter(unit => !unit.isDead)
      .map(unit => unit.index);
  }
}