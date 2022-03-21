import _ from "lodash";
import { AprilDamage } from "./AprilDamage";
import { AprilEvents } from "./AprilEvents";
import { AprilMap } from "./AprilMap";
import { AprilPlaygroundState, AprilUnitBlueprint } from "./types";
import { Hero } from "./units/Hero";
import { Unit } from "./units/Unit";
import * as april from "../../knightlands-shared/april";
import errors from "../../knightlands-shared/errors";
import { Chess } from "./chess";

const SQUARES = {
  a8:   0, b8:   1, c8:   2, d8:   3, e8:   4, 
  a7:   5, b7:   6, c7:   7, d7:   8, e7:   9, 
  a6:  10, b6:  11, c6:  12, d6:  13, e6:  14, 
  a5:  15, b5:  16, c5:  17, d5:  18, e5:  19, 
  a4:  20, b4:  21, c4:  22, d4:  23, e4:  24, 
};
const INVERT_SQUARES =
{
  '0' : 'a8',  '1': 'b8', '2' : 'c8', '3' : 'd8', '4' : 'e8',
  '5' : 'a7',  '6': 'b7', '7' : 'c7', '8' : 'd7', '9' : 'e7',
  '10': 'a6', '11': 'b6', '12': 'c6', '13': 'd6', '14': 'e6',
  '15': 'a5', '16': 'b5', '17': 'c5', '18': 'd5', '19': 'e5',
  '20': 'a4', '21': 'b4', '22': 'c4', '23': 'd4', '24': 'e4'
}
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
      const unitInstance = this.makeUnit(unit);
      if (unitInstance.unitClass === april.UNIT_CLASS_HERO) {
        this._hero = unitInstance;
      }
      this._units.push(unitInstance);
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
      const unit = this.makeUnit({ id: null, ...entry });
      if (unit.unitClass === april.UNIT_CLASS_HERO) {
        this._hero = unit;
      }
      return unit;
    });

    this.commitUnits();
  }
  
  protected updateDamageMap(): void {
    this._state.damage = this._damage.getDamageMap(this._units);
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

  public allEnemiesKilled(includingBoss: boolean): boolean  {
    const unitsLast = this._units.filter(
      unit => unit.unitClass !== april.UNIT_CLASS_HERO && (includingBoss || unit.unitClass !== april.UNIT_CLASS_BOSS)
    );
    return !unitsLast.length;
  }

  // TODO implement
  public canMoveTo(cardId: string, index: number): boolean  {
    const card = this._map.deck.find(card => card.id === cardId);
    if (card) {
      const fen = this.generate_fen(card.cardClass);
      const chess = Chess(fen);
      const moves = chess.moves({
        square: INVERT_SQUARES[this.hero.index],
        verbose: true,
        legal: false
      });
      //console.log(chess.ascii())
      return moves.some(move => SQUARES[move.to] === index);
    }
    return false;
  }


  private generate_fen(cardClass: string) {
    var empty = 0
    var fen = ''

    for (var i = 0; i <= 24; i++) {
      const foundUnit = this._units.find(unit => unit.index === i);
      if (!foundUnit && this._hero.index !== i) {
        empty++
      } else {
        if (empty > 0) {
          fen += empty
          empty = 0
        }
        if (this._hero.index === i) {
          switch(cardClass) {
            case april.CARD_CLASS_BISHOP:
              fen += 'B';
              break;
            case april.CARD_CLASS_PAWN:
              fen += 'P';
              break;
            case april.CARD_CLASS_KNIGHT:
              fen += 'N';
              break;
            case april.CARD_CLASS_KING:
              fen += 'K';
              break;
            case april.CARD_CLASS_ROOK:
              fen += 'R';
              break;
            case april.CARD_CLASS_QUEEN:
              fen += 'Q';
              break;
          }
        } else {
          fen += 'p'
        } 
      }
      
      if ([5,10,15,20,25].includes(i + 1) ) {
        fen += (empty + 3)

        if (i !== 24) {
          fen += '/'
        }

        empty = 0
      }
    }
    return fen + '/8/8/8 w KQkq - 0 1';
  }

  public resetKillTracker() {
    this._state.enemyWasKilled = false;
  }

  public moveHero(cardId: string, index: number): boolean {
    // Decide if hero can go there depending on card class
    if (!this.canMoveTo(cardId, index)) {
      return false;
    }
    
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

    this._map.croupier.tryToSpawnQueen(cardId, this.hero.index, index);
    
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

  // TODO implement
  public handleDamage(): number {
    // Handle damage if hero is on a damage spot:
    const dmgValue = this._state.damage[this.hero.index];
    this._map.modifyHp(-dmgValue);
    return dmgValue;
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
      console.log('Add 4 clowns', nextEnemiesIndexes);
      const nextEnemies = nextEnemiesIndexes.map(index => this.makeUnit({
        id: null, unitClass: april.UNIT_CLASS_CLOWN, index 
      }));
      this._units.push(...nextEnemies);
    }
    this._units = this.units.filter((unit) => unit.index !== enemy.index || unit.unitClass === april.UNIT_CLASS_HERO);
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