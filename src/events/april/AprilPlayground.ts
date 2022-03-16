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
    this.spawnDamageMap();
  }
  
  // TODO implement
  protected spawnUnits(): void {
    // Spawn enemies according to level
    this._units = [];
    this._state.units = this.units.map(unit => unit.serialize());
    this.events.units(this._state.units);
  }
  
  // TODO implement
  protected spawnDamageMap(): void {
    // Spawn enemies according to level
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

  public move() {
    /*if (this.pet.isDead()) {
      //console.log(`Pet is dead.`);
      return;
    }

    // ###### THE MAIN ENTRY POINT ######
    const targetCard = this.cards[index];
    if (!march.ADJACENT_CELLS[this.pet.index].includes(index)) {
      //console.log(`You cannot move card from ${this.pet.index} to ${index}`);
      return;
    }

    if (
      targetCard instanceof Container
      ||
      targetCard.unitClass === march.UNIT_CLASS_BOMB
    ){
      targetCard.touch();
    } else {
      this.movePetTo(targetCard);
    }

    const cell = function (unitClass) {
      if ([
        march.UNIT_CLASS_EXTRA_HP,
        march.UNIT_CLASS_DRAGON_BREATH,
        march.UNIT_CLASS_BALL_LIGHTNING,
        march.UNIT_CLASS_ENEMY_BOSS
      ].includes(unitClass)) {
        return unitClass + "\t";
      } else {
        return unitClass + "\t\t";
      }
    }

    //console.log('Final cards:');
    //console.log(cell(this.cards[0].unitClass), cell(this.cards[1].unitClass), cell(this.cards[2].unitClass));
    //console.log(cell(this.cards[3].unitClass), cell(this.cards[4].unitClass), cell(this.cards[5].unitClass));
    //console.log(cell(this.cards[6].unitClass), cell(this.cards[7].unitClass), cell(this.cards[8].unitClass));
    //console.log(' ');

    this.stepCallback();*/
  }

  public stepCallback() {
    // Count a step
    /*this._marchCroupier.increaseStepCounter();

    // Update stat
    this._state.stat.stepsToNextBoss = this._marchCroupier.stepsToNextBoss;
    this._events.stat(this._state.stat);

    // Callbacks
    this.cards.forEach((card, index) => {
      card.userStepCallback();
      this._state.cards[index] = card.serialize();
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
  
  protected moveUnitTo(/*unit: Unit, index: number*/): void {
    //this.cards[index] = unit;
    //this._events.cardMoved(unit.serialize(), index);
  }

  public moveHeroTo(/*target: Unit*/) {
    /*target.captureIndex();

    if (target.unitClass === march.UNIT_CLASS_ENEMY_BOSS) {
      if (this.pet.canKillBoss(target)) {
        this._marchCroupier.puchChestIntoQueue();
        this._marchCroupier.chestProvided(true);
      } else {
        target.touch();
        return;
      }
    }

    // Move pet
    // Move cards in a row
    // Determine a new card index > addCard(newCardIndex)
    const petIndex = this._pet.index;
    const targetIndex = target.index;

    const difference = targetIndex - petIndex;
    const isHorizontalMove = Math.abs(difference) === 1;
    if (isHorizontalMove) {
      if ([1, 4, 7].includes(petIndex)) {
        this.moveCardTo(this._pet, targetIndex);
        this.moveCardTo(this.cards[petIndex - difference], petIndex);
        this.addCard(petIndex - difference);

      } else if ([0, 2, 6, 8].includes(petIndex)) {
        const isMoveDown = [0, 2].includes(petIndex);
        const factor = isMoveDown ? 1 : -1;
        this.moveCardTo(this._pet, targetIndex);
        this.moveCardTo(this.cards[petIndex + 3 * factor], petIndex);
        this.moveCardTo(this.cards[petIndex + 6 * factor], petIndex + 3 * factor);
        this.addCard(petIndex + 6 * factor);

      } else if ([3, 5].includes(petIndex)) {
        const isMoveDown = petIndex === 5;
        const factor = isMoveDown ? 1 : -1;
        this.moveCardTo(this._pet, targetIndex);
        this.moveCardTo(this.cards[petIndex - 3 * factor], petIndex);
        this.addCard(petIndex - 3 * factor);
      }
    } else {
      if ([1, 7].includes(petIndex)) {
        const isMoveLeft = petIndex === 7;
        const factor = isMoveLeft ? 1 : -1;
        this.moveCardTo(this._pet, targetIndex);
        this.moveCardTo(this.cards[petIndex + 1 * factor], petIndex);
        this.addCard(petIndex + 1 * factor);

      } else if ([0, 2, 6, 8].includes(petIndex)) {
        const isMoveLeft = [0, 6].includes(petIndex);
        const factor = isMoveLeft ? 1 : -1;
        this.moveCardTo(this._pet, targetIndex);
        this.moveCardTo(this.cards[petIndex + 1 * factor], petIndex);
        this.moveCardTo(this.cards[petIndex + 2 * factor], petIndex + 1 * factor);
        this.addCard(petIndex + 2 * factor);

      } else if ([3, 4, 5].includes(petIndex)) {
        this.moveCardTo(this._pet, targetIndex);
        this.moveCardTo(this.cards[petIndex - difference], petIndex);
        this.addCard(petIndex - difference);
      }
    }

    // Touch card
    target.touch();

    this._marchCroupier.chestProvided(false);
    this.pet.setRespawn(false);*/
  }

  public replaceCellWith(/*oldUnit: Unit, newUnit: Unit*/) {
    /*const index = oldUnit.index;
    this.cards[index] = newUnit;
    this._events.newCard(newUnit.serialize(), index);*/
  }

  public bossKilled(): void {
    /*this._state.stat.bossesKilled++;
    this._events.stat(this._state.stat);*/
  }
  
  public gameOver(): void {
    /*this._marchUser.voidBoosters();
    this._marchUser.flushStats(this.pet);
    this._marchCroupier.reset();*/
  }
  
  public exit() {
    this._units = [];
    this._state.units = [];
    this.events.units([]);
    
    this._state.damage = [];
    this.events.damage([]);
  }
}