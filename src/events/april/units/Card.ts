import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import * as april from "../../../knightlands-shared/april";
import { AprilMap } from "../AprilMap";
import { INVERT_SQUARES, SQUARES } from "../AprilPlayground";
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

export class Card {
  protected _id: string;
  protected _cardClass: string;
  protected _nextCells: number[];
  protected _map: AprilMap;

  get map(): AprilMap {
    return this._map;
  }

  get id(): string {
    return this._id;
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
    this._cardClass = card.cardClass;
    this.setNextCells();
  }

  // TODO implement
  public setNextCells(): void {
    const fen = this._map.playground.generate_fen(this.cardClass);
    const chess = Chess(fen);
    const moves = chess.moves({
      square: INVERT_SQUARES[this._map.playground.hero.index],
      verbose: true,
      legal: false
    });
    this._nextCells = moves.map(move => SQUARES[move.to]);
  };

  public serialize(): AprilCardBlueprint {
    const card = {
      id: this._id,
      cardClass: this._cardClass,
      nextCells: this._nextCells
    } as AprilCardBlueprint;
    
    return _.cloneDeep(card);
  };

  public hasNextCell(index: number): boolean {
    return this._nextCells.includes(index);
  }
}