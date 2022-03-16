import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import * as april from "../../../knightlands-shared/april";
import { AprilMap } from "../AprilMap";
import { AprilCard } from "../types";

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
  
  constructor(card: AprilCard, map: AprilMap) {
    this._id = card.id || uuidv4().split('-').pop();
    this._cardClass = card.cardClass;
  }

  public activate(): void {};
  public touch(): void {};
  public userStepCallback(): void {};

  public serialize(): AprilCard {
    const card = {
      id: this._id,
      cardClass: this._cardClass,
      nextCells: this._nextCells
    } as AprilCard;
    
    return _.cloneDeep(card);
  };
}