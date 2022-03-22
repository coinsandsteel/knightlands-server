import _ from "lodash";

import * as april from "../../knightlands-shared/april";
import { CARD_CLASS_BISHOP, CARD_CLASS_KNIGHT, CARD_CLASS_PAWN, CARD_CLASS_ROOK, CARD_CLASS_KING, CARD_CLASS_QUEEN } from "../../knightlands-shared/april";
import { AprilEvents } from "./AprilEvents";
import { AprilMap } from "./AprilMap";
import { AprilCardBlueprint, AprilCroupierState } from "./types";
import { Card } from "./units/Card";

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

export const EXTEND_DECK = [
  CARD_CLASS_PAWN,
  CARD_CLASS_KNIGHT,
  CARD_CLASS_ROOK,
  CARD_CLASS_BISHOP,
  CARD_CLASS_QUEEN,
  CARD_CLASS_KING
];

export class AprilCroupier {
  protected _state: AprilCroupierState;
  protected _map: AprilMap;
  protected _deck: Card[] = [];
  protected _cardsInQueue: Card[] = [];
  protected _cards: Card[] = [];
  protected _usedCards: Card[] = [];
  protected _handSize: number = 4;
  protected _queenProvided: boolean;
  
  get events(): AprilEvents {
    return this._map.events;
  }
  
  get cards(): Card[] {
    return this._cards;
  }
  
  get usedCards(): Card[] {
    return this._usedCards;
  }

  get deck(): Card[] {
    return this._deck;
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
      newCard: null,
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

  public cardUsed(card: Card, storeInUsed: boolean): void {
    if (storeInUsed) {
      this._usedCards.push(card);
    }
    this._cards = this._cards.filter(
      entry => entry.id !== card.id
    );
  }

  public heroMoveCallback(card: Card, oldHeroIndex: number, newHeroIndex: number): void {
    const queenSpawned = this.spawnQueen(card, oldHeroIndex, newHeroIndex);
    this.cardUsed(card, !queenSpawned);
    this.updateNextCells();
    this.commitCards();
  }

  public updateNextCells(): void {
    this._cards.forEach((card: Card) => {
      card.setNextCells();
    })
  }

  public startSession(extendDeck: boolean) {
    this._queenProvided = false;
    this._deck = Array.from(
      { length: STARTING_DECK.length }, 
      (_, i) => { 
        return this.makeCard({ id: null, cardClass: STARTING_DECK[i], nextCells: [] });
      }
    ) as Card[];

    if (extendDeck && this._state.newCard) {
      this.extendDeck();
    }

    this.resetTable();
    this.commitCards();
  }
  
  public respawnCards(): void {
    if (this._cardsInQueue.length >= this._handSize) {
      this.purgeCards();
      this.refreshCards();
      if (this._map.heroClass === april.HERO_CLASS_ROGUE) {
        this.restoreCard();
      }
    } else {
      this.resetTable();
    }

    this.updateNextCells();

    /*this._cardsInQueue.forEach(card => {
      console.log('[Map check] _cardsInQueue', { mapEqual: this._map === card.map});
    });

    this._cards.forEach(card => {
      console.log('[Map check] _cards', { mapEqual: this._map === card.map});
    });

    this._usedCards.forEach(card => {
      console.log('[Map check] _usedCards', { mapEqual: this._map === card.map});
    });*/

    this.commitCards();
  }
  
  protected resetTable() {
    this._cardsInQueue = _.clone(this._deck);
    this.refreshCards();
    this._usedCards = [];
  }

  // Queue => Cards
  protected refreshCards() {
    // Take 4 cards from queue
    this._cards = _.sampleSize(this._cardsInQueue, this._handSize);
    // Remove those cards from queue
    this._cardsInQueue = this._cardsInQueue.filter(
      queueCard => this._cards.findIndex(card => card.id === queueCard.id) === -1
    );
  }

  // Cards => Used cards
  protected purgeCards() {
    this._usedCards.push(...this._cards);
    this._cards = [];
  }

  // 1 used card => Cards
  protected restoreCard() {
    // Sort cards by rank
    this._usedCards.sort((card1: Card, card2: Card) => {
      return card2.rank - card1.rank;
    });
    // Choose the strongest card in a used heap
    const returnedUsedCard = this._usedCards[0];
    // Lay it on the table 
    this._cards.push(returnedUsedCard);
    // Remove that card from a used heap
    this._usedCards = this._usedCards.filter(
      usedCard => usedCard.id !== returnedUsedCard.id
    );
  }

  protected makeCard(card: AprilCardBlueprint): Card {
    return new Card(card, this._map);
  }

  public spawnQueen(card: Card, oldHeroIndex: number, newHeroIndex: number): boolean {
    if (
      this._map.heroClass === april.HERO_CLASS_KNIGHT
      &&
      card && card.cardClass === CARD_CLASS_PAWN
      &&
      [5,6,7,8,9].includes(oldHeroIndex)
      &&
      [0,1,2,3,4].includes(newHeroIndex)
      &&
      !this._queenProvided
    ) {
      const queenCard = this.makeCard({ id: null, cardClass: april.CARD_CLASS_QUEEN, nextCells: [] });
      this._deck.push(queenCard);
      this._cards.push(queenCard);
      this._queenProvided = true;
      return true;
    }
    return false;
  }

  protected commitCards() {
    this._state.cardsInQueue = this._cardsInQueue.map(card => card.serialize());
    this.events.cardsInQueue(this._state.cardsInQueue.length);

    this._state.cards = this.cards.map(card => card.serialize());
    this.events.cards(this._state.cards);

    this._state.usedCards = this.usedCards.map(card => card && card.serialize());
    this.events.usedCards(this._state.usedCards.length);
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

  public getCardById(cardId: string): Card|null {
    const card = this._cards.find(entry => entry.id === cardId);
    return card || null;
  }

  public extendDeck(): void {
    this._deck.push(
      this.makeCard({ id: null, cardClass: this._state.newCard, nextCells: [] })
    );
    this._state.newCard = null;
  }

  public proposeNewCard(): void {
    this._state.newCard = _.sample(EXTEND_DECK);
    this.events.newCard(this._state.newCard);
  }
}
