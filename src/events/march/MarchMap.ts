import { MarchState } from "./types";
import { Container } from "./units/Container";
import { Pet } from "./units/Pet";
import { Unit } from "./other/UnitClass";

export class MarchMap {
  private _pet: Pet;
  private cards: Unit[];
  private activeChest?: Container;
 
  get pet(): Pet {
    return this._pet;
  }

  constructor(state: MarchState){
    // Pet creation
    this._pet = new Pet(1, 1);
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