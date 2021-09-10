import { ReturnDocument } from "mongodb";
import { ObjectId } from "mongodb";
import { Db } from "mongodb";
import { Collections } from "../database/database";
import Game from "../game";

const HistoryLength = 86400000 * 30; // 1 month

export class ActivityHistory {
    constructor() {

    }

    async hasHistory(db: Db, user: string) {
        return (await db.collection(Collections.ActivityHistory).find({ user, date: { $gte: Game.now - HistoryLength } }).count()) > 0;
    }

    async getHistory(user: string) {
        return Game.db.collection(Collections.ActivityHistory).find({ user, date: { $gte: Game.now - HistoryLength } }).toArray();
    }

    async getRecords(user: string, filter: any) {
        return Game.db.collection(Collections.ActivityHistory).find({ user, ...filter }).toArray();
    }

    async hasRecord(user: string, filter: any) {
        return (await Game.db.collection(Collections.ActivityHistory).find({ user, ...filter }).count()) > 0;
    }

    async save(db: Db, user: string, type: string, chain: string, data: any) {
        return db.collection(Collections.ActivityHistory).insertOne({ user, date: Game.now, type, data, chain, cancelled: false });
    }

    async delete(db: Db, id: ObjectId) {
        return db.collection(Collections.ActivityHistory).updateOne({ _id: id }, { $set: { cancelled: true } });
    }

    async update(db: Db, filter: any, data: any) {
        let dataQuery = {};
        for (let k in data) {
            dataQuery[`data.${k}`] = data[k];
        }

        return (await db.collection(Collections.ActivityHistory).findOneAndUpdate(filter, { $set: dataQuery }, { upsert: true, returnDocument: ReturnDocument.AFTER })).value;
    }
}