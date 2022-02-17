import _ from "lodash";
import { Collection, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import Game from "../../game";
import { TICKET_ITEM_ID } from "../../knightlands-shared/march";
import { MarchItem } from "./types";

export class MarchManager {
  private _meta: any;
  private _saveCollection: Collection;

  constructor() {
    this._saveCollection = Game.db.collection(Collections.MarchUsers);
  }
  
  get eventStartDate() {
    return this._meta.eventStartDate * 1000 || '2022-03-08 00:00:00';
  }
  
  get eventEndDate() {
    return this._meta.eventEndDate * 1000 || '2022-03-14 23:59:59';
  }

  get raidRewardCount() {
    return this._meta.raidReward;
  }

  get shopMeta() {
    return this._meta.shop;
  }

  async init() {
    this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "march_meta" });
  }

  getRaidReward() {
    let ticketItem = this.getEventTicketItems(this.raidRewardCount);
    return {
      item: ticketItem.id,
      quantity: ticketItem.quantity,
      guaranteed: true
    };
  }

  public eventIsInProgress() {
    let now = new Date();
    let start = new Date(this.eventStartDate);
    let end = new Date(this.eventEndDate);
    return now >= start && now <= end;
  }

  async loadProgress(userId: ObjectId) {
    return this._saveCollection.findOne({ _id: userId })
  }

  async saveProgress(userId: ObjectId, saveData: any) {
    return this._saveCollection.updateOne({ _id: userId }, { $set: saveData }, { upsert: true });
  }

  getMeta() {
    return this._meta;
  }

  getEventTicketItems(count) {
    const ticketItem =  Game.itemTemplates._items().findOne({ id: TICKET_ITEM_ID });

    const item: MarchItem = {
      id: ticketItem.id,
      template: ticketItem.id,
      caption: ticketItem.caption,
      quantity: count
    }

    return item;
  }
}