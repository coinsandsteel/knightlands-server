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

    async save(db: Db, user: string, type: string, chain: string, data: any) {
        return db.collection(Collections.ActivityHistory).insertOne({ user, date: Game.now, type, data, chain });
    }

    async update(db: Db, filter: any, data: any) {
        let dataQuery = {};
        for (let k in data) {
            dataQuery[`data.${k}`] = data[k];
        }

        return db.collection(Collections.ActivityHistory).updateOne(filter, { $set: dataQuery });
    }
}