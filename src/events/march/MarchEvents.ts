import _ from "lodash";
import { ObjectId } from "mongodb";
import game from "../../game";
import events from "../../knightlands-shared/events";
import { MarchBoosters, MarchCard, PetState, StatState } from "./types";

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
          { cards: _.cloneDeep(CARDS_ARRAY), effect: null },
          { cards: _.cloneDeep(CARDS_ARRAY), effect: null },
          { cards: _.cloneDeep(CARDS_ARRAY), effect: null },
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

      this._log('Card moved', [card._id, card.unitClass, 'hp:', card.hp, 'from:', oldIndex, 'to:', index]);
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

      this._log('Card HP', [card._id, card.unitClass, 'hp:', card.hp, 'index:', index]);
    }

    trapOpened(card: MarchCard, index: number) {
      this._initSequence();

      // Check if card was moved
      const newIndex = this.sequenceCards.findIndex(item => item && item._id === card._id);
      index = newIndex === -1 ? index : newIndex;

      if (!this.sequenceCards[index]) {
        this._events.sequence[this._sequence].cards[index] = { 
          _id: card._id,
          opened: card.opened
        };
      } else {
        this._events.sequence[this._sequence].cards[index] = {
          ...this._events.sequence[this._sequence].cards[index],
          opened: card.opened
        }
      }

      this._log('Trap opened/closed', [card._id, card.unitClass, 'opened:', card.opened, 'index:', index]);
    }
    
    newCard(card: MarchCard, index: number) {
      this._initSequence();
      // Only one card could be inserted to a position
      if (!this._events.sequence[this._sequence].cards[index]) {
        this._events.sequence[this._sequence].cards[index] = card;
      }

      this._log('Card add', [card._id, card.unitClass, 'hp:', card.hp, 'index:', index]);
    }
    
    cards(cards: MarchCard[]) {
      this._events.cards = cards;
    }
    
    pet(state: PetState) {
      this._events.pet = state;
    }
    
    petArmor(value: number) {
      this._events.pet = { ...this._events.pet, armor: value };
      //console.log('Pet armor', { armor: value });
    }
    
    stat(state: StatState) {
      this._events.stat = state;
      //console.log('Stat', state);
    }
    
    effect(unitClass: string, index: number, target: number[]) {
      this._initSequence();
      
      this._events.sequence[this._sequence].effect = {
        unitClass, // Animation type
        index, // Cards array index
        target // "Victim" indexes array
      };

      this._log('Effect', [unitClass, 'index:', index], { target });

      // Next step of animation (after effect played)
      this.nextSequence();
    }

    nextSequence() {
      this._sequence++;
    }

    flush() {
      game.emitPlayerEvent(this._userId, events.MarchUpdate, this._events);
      this._events = {};
      this._sequence = 0;
      console.log(' ');
    }

    balance(currency, balance) {
      this._events.balance = { 
        [currency]: balance
      };
      //console.log('Balance', { currency, balance });
    }

    preGameBoosters(boosters: MarchBoosters) {
      this._events.preGameBoosters = boosters;
      //console.log('PreGameBoosters', { preGameBoosters: this._events.preGameBoosters });
    }

    miniGameReady() {
      this._events.miniGameReady = { 
        isReady: true
      };
      //console.log('MiniGameReady');
    }

    miniGameResult(isSuccess: boolean) {
      this._events.miniGameResult = { 
        isSuccess
      };
      //console.log('MiniGameResult', { isSuccess });
    }

    dailyRewards(entries) {
      this._events.dailyRewards = entries;
      //console.log('marchDailyRewards', { entries });
    }

    pets(entries) {
      this._events.pets = entries;
      //console.log('marchPets', { entries });
    }

    _log(event, data, payload?) {
      console.log(`[Seq #${this._sequence}] ${event} ` + data.join(' '), payload);
    }
}