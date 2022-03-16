import _ from "lodash";
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
  public createCards():void  {

  }

  public startSession() {
    // TODO: calc it 
    this._state.cardsInQueue = 5; // TODO verify this value
    this.events.cardsInQueue(this._state.cardsInQueue);
    
    this._state.usedCards = [];
    this.events.usedCards(this._state.usedCards.length);
    
    this.spawnCards();
  }

  // TODO implement
  protected spawnCards(): void {
    // Spawn according to: 
    // - hero class
    // - level
    this._cards = [];
    this._state.cards = this.cards.map(card => card.serialize());
    this.events.cards(this._state.cards);
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
