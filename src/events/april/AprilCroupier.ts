import _ from "lodash";

import * as april from "../../knightlands-shared/april";
import { CARD_CLASS_BISHOP, CARD_CLASS_KNIGHT, CARD_CLASS_PAWN, CARD_CLASS_ROOK } from "../../knightlands-shared/april";
import random from "../../random";
import { AprilEvents } from "./AprilEvents";
import { AprilMap } from "./AprilMap";
import { AprilCardBlueprint, AprilCroupierState } from "./types";
import { Card } from "./units/Card";
import { Unit } from "./units/Unit";

export const STARTING_DECK = [
  CARD_CLASS_ROOK,
  CARD_CLASS_KNIGHT,
  CARD_CLASS_BISHOP,
  CARD_CLASS_PAWN,
  CARD_CLASS_PAWN,
  CARD_CLASS_PAWN,
  CARD_CLASS_PAWN,
  CARD_CLASS_PAWN,
];

export class AprilCroupier {
  protected _state: AprilCroupierState;
  protected _map: AprilMap;
  protected _deck: Card[] = [];
  protected _cardsInQueue: Card[] = [];
  protected _cards: Card[] = [];
  protected _usedCards: Card[] = [];
  protected _cardHandNumber: number = 4;
  
  get events(): AprilEvents {
    return this._map.events;
  }
  
  get cards(): Card[] {
    return this._cards;
  }
  
  get usedCards(): Card[] {
    return this._usedCards;
  }

  get hero(): Unit {
    return this._map.playground.hero;
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
      cardsInQueue: [],
      cards: [],
      usedCards: []
    } as AprilCroupierState;
  }
  
  public getState(): AprilCroupierState {
    return this._state;
  }
  
  public wakeUp(state: AprilCroupierState) {
    this._state.deck = state.deck;
    this._state.cardsInQueue = state.cardsInQueue;
    this._state.cards = state.cards;
    this._state.usedCards = state.usedCards;
  }

  public addCardToDeck(card: Card): void {
    this._deck.push(card);
  }

  public cardUsed(id: string): void {
    const cardIndex = this._state.cards.findIndex(card => card.id === id);
    this.usedCards.push(this.cards[cardIndex]);
    this.cards.splice(cardIndex, 1);

    this._state.cards = this.cards.map(card => card.serialize());
    this.events.cards(this._state.cards);

    this._state.usedCards = this.usedCards.map(card => card.serialize());
    this.events.usedCards(this._state.usedCards.length);
  }

  public startSession() {
    this._state.cardsInQueue = [];
    this.events.cardsInQueue(0);
    
    this._state.usedCards = [];
    this.events.usedCards(0);
    
    this.spawnInitialCards();
    if (this.hero.unitClass === april.HERO_CLASS_ROGUE) {
      this._cardHandNumber = 5;
    }
  }

  // TODO implement
  public spawnInitialCards(): void {
    const deckCardList = Array.from(
      { length: STARTING_DECK.length }, 
      (_, i) => { 
        return this.makeCard({ id: null, cardClass: STARTING_DECK[i], nextCells: [] });
      }
    ) as Card[];

    this._deck.push(...deckCardList);
    this._cardsInQueue = this._deck;
    // Spawn 4 cards
    [ this._cardsInQueue, this._cards ] = this.transferCard(random.shuffle(this._cardsInQueue), this._cards, 4);

    this._state.cardsInQueue = this._cardsInQueue.map(card => card.serialize());
    this.events.cardsInQueue(this._state.cardsInQueue.length);

    this._state.cards = this.cards.map(card => card.serialize());
    this.events.cards(this._state.cards);
  }

  private transferCard(first: Card[], second: Card[], cardNumber: number) {
    if (cardNumber > first.length) {
      console.log('Not enough card in queue');
      return [ first, second ];
    }
    for (var i = 0; i < cardNumber; i++) {
      second.push(first.pop());
    }

    return [ first, second ];
  }

  private makeCard(card: AprilCardBlueprint): Card {
    return new Card(card, this._map);
  }

  public respawnCards(): void {
    [ this._cards, this._usedCards ] = this.transferCard(this._cards, this._usedCards, this._cards.length);

    if (this._cardsInQueue.length < this._cardHandNumber) {
      [ this._usedCards, this._cardsInQueue ] = this.transferCard(this._usedCards, this._cardsInQueue, this._usedCards.length);
    }

    [ this._cardsInQueue, this._cards ] = this.transferCard(this._cardsInQueue, this._cards, this._cardHandNumber);

    this._state.cardsInQueue = this._cardsInQueue.map(card => card.serialize());
    this.events.cardsInQueue(this._state.cardsInQueue.length);

    this._state.cards = this.cards.map(card => card.serialize());
    this.events.cards(this._state.cards);

    this._state.usedCards = [];
    this.events.usedCards(0);
  }

  public exit() {
    this._state.cardsInQueue = [];
    this.events.cardsInQueue(0);
    
    this._cards = [];
    this._state.cards = [];
    this.events.cards([]);

    this._usedCards = [];
    this._state.usedCards = [];
    this.events.usedCards(0);
  }
}
