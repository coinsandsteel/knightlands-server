import _ from "lodash";
import { MarchCard, MarchMapState } from "./types";
import { Container } from "./units/Container";
import { Pet } from "./units/Pet";
import { Unit } from "./other/UnitClass";
import { MarchEvents } from "./MarchEvents";
import User from "../../user";
import * as march from "../../knightlands-shared/march";
import { MarchDamage } from "./MarchDamage";

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
        maxHp: 10,
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
  }

  protected setCardByIndex(card: Unit, index: number): void {
    this.cards[index] = card;
    this._state.cards[index] = card.serialize();
  }

  public makeUnit(_id: string|null, unitClass: string, hp: number, opened: boolean|null = null): Unit
  {
    const unit = new Unit(this, _id);
    if (opened !== null) {
      unit.setOpened(opened);
    }
    unit.setUnitClass(unitClass);
    unit.setHP(hp);
    return unit;
  }

  public start() {
    this._pet = new Pet(this, this._state.pet);

    // Start the card game from scratch
    // TODO MarchCroupier should return an initial card list
    const initialCardList = [
      { unitClass: march.UNIT_CLASS_GOLD, hp: 2 },
      { unitClass: march.UNIT_CLASS_ARMOR, hp: 3 },
      { unitClass: march.UNIT_CLASS_CHEST, hp: 5 },
      { unitClass: march.UNIT_CLASS_HP, hp: 2 },
      { unitClass: march.UNIT_CLASS_PET, hp: 10 },
      { unitClass: march.UNIT_CLASS_ENEMY, hp: 3 },
      { unitClass: march.UNIT_CLASS_BARRELL, hp: 4 },
      { unitClass: march.UNIT_CLASS_TRAP, hp: 1, opened: true },
      { unitClass: march.UNIT_CLASS_EXTRA_HP, hp: 2 },
    ] as MarchCard[];

    this.parseCards(initialCardList);
  }

  public load(state: MarchMapState) {
    // Parse pet
    this._pet = new Pet(this, state.pet);
    
    // Parse cards
    this.parseCards(state.cards);
  }

  protected parseCards(cards: MarchCard[]) {
    cards.forEach((unit: MarchCard, index: number) => {
      const isPet = unit.unitClass === march.UNIT_CLASS_PET;
      if (isPet) {
        this.pet.setHP(unit.hp);
      }
      this.setCardByIndex(
        isPet ? 
          this.pet
          : 
          this.makeUnit(null, unit.unitClass, unit.hp, unit.opened),
        index
      );
    });
  }

  public touch(index: number) {
    // ###### THE MAIN ENTRY POINT ######
    // Touch a card
  }

  public movePetTo(index) {
    // Move pet
    // Move cards in a row
    // Determine a new card index > addCard(newCardIndex)
    //  .getCardByIndex(index).touch()
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

  public swapPetCellTo(index) {
    // Move pet to index
    // Move next card to old pet's position
  }

  public replaceCellWith(oldUnit: Unit, newUnit: Unit) {

  }

  public addCard() {
    // Determine where should cards be added (indexes)
    // Check probabilities and pick a card
    // Insert a new card
  }

  public handleScriptDamage(attacker, amount, direction) {
    // Choose cards to attack/heal
    // Modify HP
    // Launch callbacks to all the affected cards
    this._damage.handleScriptDamage(attacker, this.getIndexOfCard(attacker), amount, direction);
  }

  private getIndexOfCard(card) {
    return _.findIndex(this.cards, item => item._id === card.id)
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
      this.activeChest.destroy();
    }
  }

  public addGold(amount: number): void {

  }

  public exit(): void {

  }
}