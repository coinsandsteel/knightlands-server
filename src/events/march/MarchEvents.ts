import _ from "lodash";
import { ObjectId } from "mongodb";
import game from "../../game";
import events from "../../knightlands-shared/events";
import { MarchCard, PetState, StatState } from "./types";

const CARDS_ARRAY = [
  null, null, null, 
  null, null, null, 
  null, null, null
];

export class MarchEvents {
    private _events: any;
    private _userId: ObjectId;
    private _sequence: number;

    constructor(userId: ObjectId) {
        this._userId = userId;
        this._events = {};
        this._sequence = 0;
    }

    get sequenceCards() {
      return this._events.sequence ? this._events.sequence[this._sequence].cards : [];
    }

    protected _initSequence(){
      if (!this._events.sequence) {
        this._events.sequence = [
          // Cards move events
          // New cards events
          // Artifact effect event
          { cards: _.cloneDeep(CARDS_ARRAY), effect: null },
          // New cards events (after any artifact effect)
          // HP changed events
          { cards: _.cloneDeep(CARDS_ARRAY) }
        ];
      }
    }

    cardMoved(card: MarchCard, index: number) {
      this._initSequence();

      let updateValue = { _id: card._id };
      
      // Check if card was updated
      const oldIndex = this.sequenceCards.findIndex(item => item && item._id === card._id);
      if (oldIndex !== -1) {
        updateValue = this.sequenceCards[oldIndex];
        this._events.sequence[this._sequence].cards[oldIndex] = null;
      }
      this._events.sequence[this._sequence].cards[index] = updateValue

      console.log('Card moved', { _id: card._id, toIndex: index, _sequence: this._sequence });
    }
    
    cardHp(card: MarchCard, index: number) {
      this._initSequence();

      // Check if card was moved
      const newIndex = this.sequenceCards.findIndex(item => item && item._id === card._id);
      index = newIndex === -1 ? index : newIndex;

      if (!this.sequenceCards[index]) {
        this._events.sequence[this._sequence].cards[index] = { 
          _id: card._id, 
          hp: card.hp
        };
      } else {
        this._events.sequence[this._sequence].cards[index] = {
          ...this._events.sequence[this._sequence].cards[index],
          hp: card.hp
        }
      }
      console.log('Card HP', { _id: card._id, hp: card.hp, _sequence: this._sequence });
    }
    
    newCard(card: MarchCard, index: number) {
      this._initSequence();
      // Only one card could be inserted to a position
      if (!this._events.sequence[this._sequence].cards[index]) {
        this._events.sequence[this._sequence].cards[index] = card;
      }
      console.log('New card', { ...card, index, _sequence: this._sequence });
    }
    
    cards(cards: MarchCard[]) {
      this._events.cards = cards;
    }
    
    pet(state: PetState) {
      this._events.pet = state;
    }
    
    petArmor(value: number) {
      this._events.pet = { ...this._events.pet, armor: value };
      console.log('Pet armor', { armor: value });
    }
    
    stat(state: StatState) {
      this._events.stat = state;
      console.log('Stat', state);
    }
    
    effect(unitClass: string, index: number, target: number[]) {
      if (this._sequence > 0) {
        throw new Error('Only one artifact could be activated!');
      }
      
      this._initSequence();
      
      this._events.sequence[this._sequence].effect = {
        unitClass, // Animation type
        index, // Cards array index
        target // "Victim" indexes array
      };
      console.log('Effect', { unitClass, index, target, step: this._sequence });

      // Next step of animation (after effect played)
      this.nextSequence();
    }

    nextSequence() {
      this._sequence++;
    }

    flush() {
      console.log('Flush', this._events);
      game.emitPlayerEvent(this._userId, events.MarchUpdate, this._events);
      this._events = {};
      this._sequence = 0;
    }

    balance(currency, balance) {
      this._events.balance = { 
        [currency]: balance
      };
      console.log('Balance', { currency, balance });
    }

    preGameBoosters(preGameBoosters) {
      this._events.preGameBoosters = preGameBoosters;
      console.log('PreGameBoosters', { preGameBoosters: this._events.preGameBoosters });
    }

    miniGameReady() {
      this._events.miniGameReady = { 
        isReady: true
      };
      console.log('MiniGameReady');
    }

    miniGameResult(isSuccess: boolean) {
      this._events.miniGameResult = { 
        isSuccess
      };
      console.log('MiniGameResult', { isSuccess });
    }
}