import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import * as april from "../../../knightlands-shared/april";
import { AprilMap } from "../AprilMap";
import { Chess } from "../chess";
import { AprilCardBlueprint } from "../types";

const CARD_RANKS = {
  [april.CARD_CLASS_PAWN]: 0,
  [april.CARD_CLASS_KNIGHT]: 1,
  [april.CARD_CLASS_KING]: 2,
  [april.CARD_CLASS_BISHOP]: 3,
  [april.CARD_CLASS_ROOK]: 4,
  [april.CARD_CLASS_QUEEN]: 5
};

const SQUARES = {
  a8:   0, b8:   1, c8:   2, d8:   3, e8:   4, 
  a7:   5, b7:   6, c7:   7, d7:   8, e7:   9, 
  a6:  10, b6:  11, c6:  12, d6:  13, e6:  14, 
  a5:  15, b5:  16, c5:  17, d5:  18, e5:  19, 
  a4:  20, b4:  21, c4:  22, d4:  23, e4:  24, 
};

const INVERT_SQUARES = {
  '0' : 'a8',  '1': 'b8', '2' : 'c8', '3' : 'd8', '4' : 'e8',
  '5' : 'a7',  '6': 'b7', '7' : 'c7', '8' : 'd7', '9' : 'e7',
  '10': 'a6', '11': 'b6', '12': 'c6', '13': 'd6', '14': 'e6',
  '15': 'a5', '16': 'b5', '17': 'c5', '18': 'd5', '19': 'e5',
  '20': 'a4', '21': 'b4', '22': 'c4', '23': 'd4', '24': 'e4'
};

export class Card {
  protected _id: string;
  protected _hash: string;
  protected _cardClass: string;
  protected _nextCells: number[];
  protected _map: AprilMap;
  protected _werewolf: boolean;

  get map(): AprilMap {
    return this._map;
  }

  get id(): string {
    return this._id;
  }

  get werewolf(): boolean {
    return this._werewolf;
  }
  
  get cardClass(): string {
    return this._cardClass;
  }
  
  get rank(): number {
    return CARD_RANKS[this._cardClass];
  }
  
  constructor(card: AprilCardBlueprint, map: AprilMap) {
    this._map = map;
    this._id = card.id || uuidv4().split('-').pop();
    this._hash = card.hash || uuidv4().split('-').pop();
    this._cardClass = card.cardClass;
    this._werewolf = card.werewolf || false;
    this.setNextCells();
  }

  public setNextCells(): void {
    const fen = this.generateFen();
    const chess = Chess(fen);
    const heroIndex = this.map.playground.hero.index;

    const moves = chess.moves({
      square: INVERT_SQUARES[heroIndex],
      verbose: true,
      legal: false
    });
    
    this._nextCells = moves
      .map(move => SQUARES[move.to])
      .filter(index => index !== heroIndex);
    
    // Exclude boss cell if minions are alive
    if (
      this.map.level === 9
      &&
      this._nextCells.includes(12)
      &&
      !this.map.playground.allEnemiesKilled(false)
    ) {
      this._nextCells = this._nextCells.filter(index => index !== 12);
    }
  };

  public serialize(): AprilCardBlueprint {
    const card = {
      id: this._id,
      hash: this._hash,
      cardClass: this._cardClass,
      nextCells: this._nextCells,
      werewolf: this._werewolf
    } as AprilCardBlueprint;
    
    return _.cloneDeep(card);
  };

  public hasNextCell(index: number): boolean {
    return this._nextCells.includes(index);
  }

  public cardSpawnCallback(): void {
    this.setNextCells();
  }

  public regenerateHash(): void {
    this._hash = uuidv4().split('-').pop();
  }

  public setCardClass(cardClass: string): void {
    if (
      this._cardClass === april.CARD_CLASS_PAWN
      &&
      cardClass === april.CARD_CLASS_QUEEN
    ) {
      this._werewolf = true;
    }
    this._cardClass = cardClass;
    this.setNextCells();
  }

  public swapToPawn(): void {
    if (this._werewolf) {
      this._cardClass = april.CARD_CLASS_PAWN;
      this.setNextCells();
    }
  }

  public generateFen() {
    let empty = 0;
    let fen = '';
    const playground = this._map.playground;
    for (let i = 0; i <= 24; i++) {
      const foundUnit = playground.units.find(unit => unit.index === i);
      if (!foundUnit && playground.hero.index !== i) {
        empty++;
      } else {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        if (playground.hero.index === i) {
          switch(this.cardClass) {
            case april.CARD_CLASS_BISHOP:
              fen += 'B';
              break;
            case april.CARD_CLASS_PAWN:
              fen += 'P';
              break;
            case april.CARD_CLASS_KNIGHT:
              fen += 'N';
              break;
            case april.CARD_CLASS_KING:
              fen += 'K';
              break;
            case april.CARD_CLASS_ROOK:
              fen += 'R';
              break;
            case april.CARD_CLASS_QUEEN:
              fen += 'Q';
              break;
          }
        } else {
          fen += 'p';
        } 
      }
      
      if ([5,10,15,20,25].includes(i + 1) ) {
        fen += (empty + 3);
        if (i !== 24) {
          fen += '/';
        }
        empty = 0;
      }
    }
    return fen + '/8/8/8 w KQkq - 0 1';
  }
}