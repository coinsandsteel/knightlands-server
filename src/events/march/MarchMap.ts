import { MarchCell, MarchMapState } from "./types";
import { Container } from "./units/Container";
import { Pet } from "./units/Pet";
import { Unit } from "./other/UnitClass";
import { MarchEvents } from "./MarchEvents";
import User from "../../user";
import { Artifact } from "./units/Artifact";
import * as march from "../../knightlands-shared/march";

export class MarchMap {
  private _state: MarchMapState;
  private _events: MarchEvents;
  private _user: User;

  private cards: Unit[];
  private activeChest?: Container;
  private _pet: Pet;
 
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
        bossesKilled: 0
      },
      pet: {
        penaltySteps: 0,
        class: 1,
        level: 1,
        armor: 0
      },
      cells: []
    } as MarchMapState;
  }

  public getState(): MarchMapState {
    return this._state;
  }

  get pet(): Pet {
    return this._pet;
  }

  public init() {
    const pet = this._state.pet;
    this._pet = new Pet(
      this,
      pet.class,
      pet.level,
      pet.armor,
      pet.penaltySteps
    );

    // DEMO
    this.cards = [
      this.makeUnit(march.UNIT_CLASS_GOLD, 1),
      this.makeUnit(march.UNIT_CLASS_ARMOR, 2),
      this.makeUnit(march.UNIT_CLASS_CHEST, 5),

      this.makeUnit(march.UNIT_CLASS_HP, 2),
      this._pet,
      this.makeUnit(march.UNIT_CLASS_ENEMY, 3),

      this.makeUnit(march.UNIT_CLASS_BARRELL, 2),
      this.makeUnit(march.UNIT_CLASS_TRAP, 3),
      this.makeUnit(march.UNIT_CLASS_EXTRA_HP, 4),
    ];
  }

  public makeUnit(unitClass: string, hp: number): Unit
  {
    const unit = new Unit(this);
    unit.setUnitClass(unitClass);
    unit.setHP(hp);
    return unit;
  }

  public start() {
    // Start the card game from scratch
  }

  public load(state: MarchMapState) {
    // Init the card game
    state.cells.forEach(cell => {

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

  public modifyHP(index, amount, direction) {
    // Choose cells to attack/heal
    // Modify HP
    // Launch callbacks to all the affected cells
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