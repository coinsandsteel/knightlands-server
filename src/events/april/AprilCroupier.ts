import _ from "lodash";
import errors from "../../knightlands-shared/errors";
import { AprilEvents } from "./AprilEvents";
import { AprilMap } from "./AprilMap";
import { AprilCroupierState } from "./types";
import { Card } from "./units/Card";

export class AprilCroupier {
  protected _state: AprilCroupierState;
  protected _map: AprilMap;
  protected _cards: Card[] = [];
  protected _usedCards: Card[] = [];
  
  get events(): AprilEvents {
    return this._map.events;
  }
  
  get cards(): Card[] {
    return this._cards;
  }
  
  get usedCards(): Card[] {
    return this._usedCards;
  }
  
  constructor(state: AprilCroupierState|null, map: AprilMap) {
    this._map = map;

    if (state) {
      this._state = state;
    } else {
      this.setInitialState();
    }
  }

  public setInitialState() {
    this._state = {
      cardsInQueue: 0,
      cards: [],
      usedCards: []
    } as AprilCroupierState;
  }
  
  public getState(): AprilCroupierState {
    return this._state;
  }
  
  public wakeUp(state: AprilCroupierState) {
    this._state.cardsInQueue = state.cardsInQueue;
    this._state.cards = state.cards;
    this._state.usedCards = state.usedCards;
    this.createCards();
  }
  
  // TODO implement
  public createCards(): void  {
    // Make units from blueprints
    // Store it in this._cards and this._state.usedCards
  }

  // TODO implement
  public cardUsed(id: string): void {
    // Remove card from this._state.cards, this._cards
    // Add a "cards" event

    // Add card to this._state.usedCards, this._usedCards
    // Void card's nextCells (no need to store it in usedCards)
    // Add a "usedCards" event
  }

  public startSession() {
    // TODO: calc it 
    this._state.cardsInQueue = 5;
    this.events.cardsInQueue(this._state.cardsInQueue);
    
    this._state.usedCards = [];
    this.events.usedCards(0);
    
    this.spawnInitialCards();
  }

  // TODO implement
  public spawnInitialCards(): void {
    // Spawn 4 cards
    this._cards = [];
    this._state.cards = this.cards.map(card => card.serialize());
    this.events.cards(this._state.cards);
  }

  // TODO implement
  public respawnCards(): void {
    // Add all cards to this._state.usedCards, this._usedCards
    // Void all card's nextCells (no need to store it in usedCards)
    // Add a "usedCards" event
    // Send a number, not a cards list!!!
    this.events.usedCards(this._state.usedCards.length);

    // Re-spawn cards (Rogue got 5 cards at the respawn)
    this._cards = [];
    this._state.cards = this.cards.map(card => card.serialize());
    this.events.cards(this._state.cards);

    // Set a proper value
    this._state.cardsInQueue = 5;
    this.events.cardsInQueue(this._state.cardsInQueue);
  }

  public exit() {
    this._state.cardsInQueue = 0;
    this.events.cardsInQueue(0);
    
    this._cards = [];
    this._state.cards = [];
    this.events.cards([]);

    this._usedCards = [];
    this._state.usedCards = [];
    this.events.usedCards(0);
  }
}
