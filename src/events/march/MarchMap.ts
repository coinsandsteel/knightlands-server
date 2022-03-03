import _ from "lodash";
import { MarchBoosters, MarchCard, MarchMapState, PetState, StatState } from "./types";
import { Container } from "./units/Container";
import { Pet } from "./units/Pet";
import { Unit } from "./other/UnitClass";
import { MarchEvents } from "./MarchEvents";
import { MarchDamage } from "./MarchDamage";
import User from "../../user";
import * as march from "../../knightlands-shared/march";
import { Enemy } from "./units/Enemy";
import { Loot } from "./units/Loot";
import { Artifact } from "./units/Artifact";
import { MarchUser } from "./MarchUser";
import { MarchCroupier } from "./MarchCroupier";
import Game from "../../game";


export enum ActiveUnits {
  UNIT_CLASS_BALL_LIGHTNING,
  UNIT_CLASS_BOMB,
  UNIT_CLASS_DRAGON_BREATH,
  UNIT_CLASS_BOW
};

export class MarchMap {
  private _state: MarchMapState;
  private _events: MarchEvents;
  private _user: User;
  private _damage: MarchDamage;
  private _marchUser: MarchUser;
  private _marchCroupier: MarchCroupier;

  protected cards: Unit[] = [];
  protected activeChest?: Container;
  protected _pet: Pet;

  constructor(state: MarchMapState | null, events: MarchEvents, marchUser: MarchUser, user: User) {
    this._events = events;
    this._user = user;
    this._marchUser = marchUser;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }

  public setInitialState() {
    this._state = {
      stat: {
        stepsToNextBoss: null,
        bossesKilled: 0,
        penaltySteps: 0
      },
      pet: {
        petClass: 1,
        level: 1,
        armor: 0
      },
      cards: []
    } as MarchMapState;
  }

  public getState(): MarchMapState {
    return this._state;
  }

  get events(): MarchEvents {
    return this._events;
  }

  get pet(): Pet {
    return this._pet;
  }

  get marchUser(): MarchUser {
    return this._marchUser;
  }

  get croupier(): MarchCroupier {
    return this._marchCroupier;
  }

  public init() {
    // HP = 1 because we need to ensure that it will be reset to 10+ later
    this._pet = this.makeUnit({ _id: null, unitClass: march.UNIT_CLASS_PET, hp: 1 }) as Pet;
    this._pet.reset();
    
    this._damage = new MarchDamage(this.cards, this.pet);
    this._marchCroupier = new MarchCroupier(this);

    this.load(this._state);
  }

  protected setCardByIndex(card: Unit, index: number): void {
    this.cards[index] = card;
    this._state.cards[index] = card.serialize();
  }

  public makeUnit(card: MarchCard): Unit
  {
    let unit = null;
    switch (card.unitClass) {
      case march.UNIT_CLASS_PET:{
        unit = new Pet(card, this);
        break;
      }
      case march.UNIT_CLASS_BALL_LIGHTNING:
      case march.UNIT_CLASS_DRAGON_BREATH:
      case march.UNIT_CLASS_BOW:
      case march.UNIT_CLASS_BOMB:{
        unit = new Artifact(card, this);
        break;
      }
      case march.UNIT_CLASS_CHEST:
      case march.UNIT_CLASS_BARREL:{
        unit = new Container(card, this);
        break;
      }
      case march.UNIT_CLASS_ENEMY:
      case march.UNIT_CLASS_ENEMY_BOSS:
      case march.UNIT_CLASS_TRAP:{
        unit = new Enemy(card, this);
        break;
      }
      case march.UNIT_CLASS_HP:
      case march.UNIT_CLASS_EXTRA_HP:
      case march.UNIT_CLASS_ARMOR:
      case march.UNIT_CLASS_GOLD:{
        unit = new Loot(card, this);
        break;
      }
    }

    return unit;
  }

  // Start the card game from scratch
  public restart(petClass: number, level: number, boosters: MarchBoosters) {
    this._marchUser.purchasePreGameBoosters(boosters);
    this._marchUser.resetSessionGoldAndBoosters(boosters);
    
    this._state.pet.petClass = petClass;
    this._state.pet.level = level;
    this._state.pet.armor = 0;

    this.pet.setAttributes(this._state.pet);
    this.pet.reset();

    if (this._marchUser.canUsePreGameBooster(march.BOOSTER_HP)) {
      this.pet.upgradeHP(1);
    }

    this._marchCroupier.reset();
    
    this._state.stat.stepsToNextBoss = this._marchCroupier.stepsToNextBoss;
    this._state.stat.bossesKilled = 0;
    this._state.stat.penaltySteps = 0;
    
    const initialCardList = Array.from(
      { length: 9 }, 
      (_, i) => i == 4 ? 
        this.pet.serialize() 
        : 
        this._marchCroupier.getCard(true)
    ) as MarchCard[];
    
    this.load({
      stat: this._state.stat,
      pet: this._state.pet,
      cards: initialCardList,
    } as MarchMapState);
    
    this._events.pet(this._state.pet);
    this._events.stat(this._state.stat);
    this._events.cards(
      this.cards.map(card => card.serialize())
    );
  }

  public exit(sendEvents: boolean) {
    this._marchUser.resetSessionGoldAndBoosters();
    this._marchUser.voidBoosters();
    
    this._state.stat.stepsToNextBoss = 0;
    this._state.stat.bossesKilled = 0;
    this._state.stat.penaltySteps = 0;

    this._state.cards = [];

    if (sendEvents) {
      this._events.stat(this._state.stat);
      this._events.cards([]);
    }
  }

  public load(state: MarchMapState) {
    // Parse stat
    this.parseStat(state.stat);
    // Parse cards
    this.parseCards(state.cards);
    // Set pet attributes
    this.parsePet(state.pet);
  }

  protected parseCards(cards: MarchCard[]) {
    cards.forEach((unit: MarchCard, index: number) => {
      const newUnit = this.makeUnit(unit);
      if (newUnit.unitClass === march.UNIT_CLASS_PET) {
        this._pet = newUnit as Pet;
      }
      this.setCardByIndex(newUnit, index);
    });
  }

  protected parsePet(state: PetState): void {
    if (!this._pet) {
      throw new Error("Pet is empty.");
    }
    this.pet.setAttributes(state);
  }

  protected parseStat(state: StatState): void {
    this._state.stat.stepsToNextBoss = state.stepsToNextBoss;
    this._state.stat.bossesKilled = state.bossesKilled;
    this._state.stat.penaltySteps = state.penaltySteps;
  }

  public touch(index: number) {
    if (this.pet.isDead()) {
      console.log(`Pet is dead.`);
      return;
    }

    // ###### THE MAIN ENTRY POINT ######
    const targetCard = this.cards[index];
    if (!march.ADJACENT_CELLS[this.pet.index].includes(index)) {
      console.log(`You cannot move card from ${this.pet.index} to ${index}`);
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

    console.log('Final cards:');
    console.log(cell(this.cards[0].unitClass), cell(this.cards[1].unitClass), cell(this.cards[2].unitClass));
    console.log(cell(this.cards[3].unitClass), cell(this.cards[4].unitClass), cell(this.cards[5].unitClass));
    console.log(cell(this.cards[6].unitClass), cell(this.cards[7].unitClass), cell(this.cards[8].unitClass));
    console.log(' ');

    // Count a step
    this._marchCroupier.increaseStepCounter();
  }

  protected moveCardTo(unit: Unit, index: number): void {
    this.cards[index] = unit;
    this._events.cardMoved(unit.serialize(), index);
  }

  public movePetTo(target: Unit) {
    target.captureIndex();

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
    
    // Callbacks
    this.cards.forEach(card => {
      card.userStepCallback();
    });
    
    this._state.stat.stepsToNextBoss = this._marchCroupier.stepsToNextBoss;
    // Reduce penalty
    this.reducePenalty();
    this._events.stat(this._state.stat);
  }

  public reducePenalty(): void {
    this._state.stat.penaltySteps--;
    if (this._state.stat.penaltySteps <= 0) {
      this._state.stat.penaltySteps = 0;
    }
  };

  public enablePenalty(steps): void {
    this._state.stat.penaltySteps = steps;
  }

  public swapPetCellTo(unit: Unit) {
    // Move pet to index
    // Move next card to old pet's position
    const petIndex = this._pet.index;
    const unitIndex = unit.index;

    this.cards[petIndex] = this.cards[unitIndex];
    this.cards[unitIndex] = this.pet;

    this._events.cardMoved(this.pet.serialize(), unitIndex);
    this._events.cardMoved(unit.serialize(), petIndex);
  }

  public replaceCellWith(oldUnit: Unit, newUnit: Unit) {
    const index = oldUnit.index;
    this.cards[index] = newUnit;
    this._events.newCard(newUnit.serialize(), index);
  }

  public addCard(newCardIndex: number) {
    // Insert a new card via croupier
    const newCard = this._marchCroupier.getCard() as Unit;
    this.cards[newCardIndex] = newCard;
    this._events.newCard(newCard.serialize(), newCardIndex);
  }

  public handleDamage(attacker: Unit, direction: string): void {
    // Choose cards to attack/heal
    const victims = this._damage.getVictims(attacker, direction);
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
    })
  }

  public getIndexOfCard(card: Unit) {
    return _.findIndex(this.cards, item => item.id === card.id)
  }

  public launchMiniGame(chest: Container) {
    // Set active chest
    this.activeChest = chest;
    // Set key number to the chest
    this.activeChest.setRandomKeyNumber();
    // Send an event  to front-end
    this._events.miniGameReady();
  }

  public tryToOpenChest(keyNumber: number) {
    this.activeChest.tryToOpenChest(keyNumber);
  }

  public gameOver(): void {
    this._marchUser.voidBoosters();
    this._marchUser.flushStats(this.pet);
    this._marchCroupier.reset();
  }

  public bossKilled(): void {
    this._state.stat.bossesKilled++;
    this._events.stat(this._state.stat);
  }
}