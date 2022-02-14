import _ from "lodash";
import { ObjectId } from "mongodb";
import game from "../../game";
import events from "../../knightlands-shared/events";
import { MarchCard } from "./types";

const CARDS_ARRAY = [
  null, null, null, 
  null, null, null, 
  null, null, null
];

export class MarchEvents {
    private _events: any;
    private _userId: ObjectId;
    private _step: number;

    constructor(userId: ObjectId) {
        this._userId = userId;
        this._events = {};
        this._step = 0;
    }

    protected _initSequence(){
      if (!this._events.sequence) {
        this._events.sequence = [
          // Cards move events
          // New cards events
          // Artifact effect event
          { cards: null, effect: null },
          // New cards events (after any artifact effect)
          // HP changed events
          { cards: null }
        ];
      }
    }

    cardMoved(card: MarchCard, newIndex: number) {
      if (this._step > 0) {
        throw new Error('Moving cards at the 2-nd step is not allowed!');
      }
      this._initSequence();
      this._events.sequence[this._step].cards[newIndex] = { _id: card._id };
    }
    
    cardHp(card: MarchCard, index: number) {
      this._initSequence();
      this._events.sequence[this._step].cards[index] = { _id: card._id, hp: card.hp };
    }

    newCard(card: MarchCard, index: number) {
      this._initSequence();
      this._events.sequence[this._step].cards[index] = card;
    }

    effect(unitClass: string, index: number, target: number[]) {
      if (this._step > 0) {
        throw new Error('Only one effect could be played once!');
      }
      
      this._events.effect = {
        unitClass, // Animation type
        index, // Cards array index
        target // "Victim" indexes array
      };

      // Next step of animation (after effect played)
      this.nextStep();
    }

    nextStep() {
      this._step++;
    }

    flush() {
      game.emitPlayerEvent(this._userId, events.MarchUpdate, this._events);
      this._events = {};
      this._step = 0;
    }

    balance(currency, balance) {
      this._events.balance = { 
        [currency]: balance
      };
    }
}