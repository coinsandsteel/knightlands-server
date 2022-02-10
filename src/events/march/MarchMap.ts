import _ from "lodash";
import { MarchCard, MarchMapState, PetState, StatState } from "./types";
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

export class MarchMap {
  private _state: MarchMapState;
  private _events: MarchEvents;
  private _user: User;
  private _damage: MarchDamage;

  protected cards: Unit[] = [];
  protected activeChest?: Container;
  protected _pet: Pet;

  constructor(state: MarchMapState | null, events: MarchEvents, user: User) {
    this._events = events;
    this._user = user;

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

  get pet(): Pet {
    return this._pet;
  }

  public init() {
    this._damage = new MarchDamage(this.cards);
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
      case march.UNIT_CLASS_BARRELL:{
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
  public restart() {
    // TODO MarchCroupier should return an initial card list
    const initialCardList = [
      { _id: null, unitClass: march.UNIT_CLASS_GOLD, hp: 2 },
      { _id: null, unitClass: march.UNIT_CLASS_ARMOR, hp: 3 },
      { _id: null, unitClass: march.UNIT_CLASS_CHEST, hp: 5 },
      { _id: null, unitClass: march.UNIT_CLASS_HP, hp: 2 },
      { _id: null, unitClass: march.UNIT_CLASS_PET, hp: 10 },
      { _id: null, unitClass: march.UNIT_CLASS_ENEMY, hp: 3 },
      { _id: null, unitClass: march.UNIT_CLASS_BARRELL, hp: 4 },
      { _id: null, unitClass: march.UNIT_CLASS_TRAP, hp: 1, opened: true },
      { _id: null, unitClass: march.UNIT_CLASS_EXTRA_HP, hp: 2 },
    ] as MarchCard[];

    this._state.pet.armor = 0;
    this._state.stat.bossesKilled = 0;
    this._state.stat.penaltySteps = 0;
    // TODO calculate inital steps count
    this._state.stat.stepsToNextBoss = null;

    this.load({
      stat: this._state.stat,
      pet: this._state.pet,
      cards: initialCardList,
    } as MarchMapState);
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
    // ###### THE MAIN ENTRY POINT ######
    // Touch a card
    const targetCard = this.cards[index];
    targetCard.touch();
  }

  public movePetTo(target: Unit) {
    // Move pet
    // Move cards in a row
    // Determine a new card index > addCard(newCardIndex)
    //  .getCardByIndex(index).touch()
    const petIndex = this.getIndexOfCard(this._pet);
    const targetIndex = this.getIndexOfCard(target);

    const difference = targetIndex - petIndex;
    const isHorizontalMove = Math.abs(difference) === 1;
    if (isHorizontalMove) {
      if ([1, 4, 7].includes(petIndex)) {
        this.cards[targetIndex] = this._pet;
        this.cards[petIndex] = this.cards[petIndex - difference];
        this.addCard(petIndex - difference);
      } else if ([0, 2, 6, 8].includes(petIndex)) {
        const isMoveDown = [0, 2].includes(petIndex);
        const factor = isMoveDown ? 1 : -1;
        this.cards[targetIndex] = this._pet;
        this.cards[petIndex] = this.cards[petIndex + 3 * factor];
        this.cards[petIndex + 3 * factor] = this.cards[petIndex + 6 * factor];
        this.addCard(petIndex + 6 * factor);
      } else if ([3, 5].includes(petIndex)) {
        const isMoveDown = petIndex === 5;
        const factor = isMoveDown ? 1 : -1;
        this.cards[targetIndex] = this._pet;
        this.cards[petIndex] = this.cards[petIndex + 3 * factor];
        this.addCard(petIndex + 3 * factor);
      }
    } else {
      if ([1, 7].includes(petIndex)) {
        const isMoveLeft = petIndex === 7;
        const factor = isMoveLeft ? 1 : -1;
        this.cards[targetIndex] = this._pet;
        this.cards[petIndex] = this.cards[petIndex + 1 * factor];
        this.addCard(petIndex + 1 * factor);
      } else if ([0, 2, 6, 8].includes(petIndex)) {
        const isMoveLeft = [0, 6].includes(petIndex);
        const factor = isMoveLeft ? 1 : -1;
        this.cards[targetIndex] = this._pet;
        this.cards[petIndex] = this.cards[petIndex + 1 * factor];
        this.cards[petIndex + 1 * factor] = this.cards[petIndex + 2 * factor];
        this.addCard(petIndex + 2 * factor);
      } else if ([3, 4, 5].includes(petIndex)) {
        this.cards[targetIndex] = this._pet;
        this.cards[petIndex] = this.cards[petIndex - difference];
        this.addCard(petIndex - difference);
      }
    }

    this.cards.forEach(card => {
      card.userStepCallback();
    });

    this.reducePenalty();
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
    const petIndex = this.getIndexOfCard(this._pet);
    const unitIndex = this.getIndexOfCard(unit);

    this.cards[petIndex] = this.cards[unitIndex];
    this.cards[unitIndex] = this.pet;
  }

  public replaceCellWith(oldUnit: Unit, newUnit: Unit) {
    const index = this.getIndexOfCard(oldUnit);
    this.cards[index] = newUnit;
  }

  public addCard(newCardIndex: number) {
    // Determine where should cards be added (indexes)
    // Check probabilities and pick a card
    // Insert a new card
  }

  public handleScriptDamage(attacker: Unit, direction: string): void {
    // Choose cards to attack/heal
    // Modify HP
    // Launch callbacks to all the affected cards
    const attackerOldIndex = this.getIndexOfCard(this.pet);
    this._damage.handleScriptDamage(attacker, attackerOldIndex, direction);
  }

  private getIndexOfCard(card: Unit) {
    return _.findIndex(this.cards, item => item.id === card.id)
  }

  public launchMiniGame(chest: Container) {
    // Set active chest
    this.activeChest = chest;
    // Set key number to the chest
    this.activeChest.setRandomKeyNumber();
    // Send an event  to front-end
  }

  public tryToOpenChest(keyNumber: number) {
    // Check key number
    if (this.activeChest.tryToOpen(keyNumber)) {
      // Success
      this.activeChest.replaceWithLoot();
    } else {
      // Fail
      this.activeChest.replaceWithEnemy();
    }
  }

  public addGold(amount: number): void {

  }

  public exit(): void {

  }
}