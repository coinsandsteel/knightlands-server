import { Collections } from "../database/database";
import Game from "../game";

const HistoryLength = 86400000 * 30; // 1 month

export class ActivityHistory {
    constructor() {

    }

    async hasHistory(user: string) {
        return (await Game.db.collection(Collections.ActivityHistory).find({ user, date: { $gte: Game.now - HistoryLength } }).count()) > 0;
    }

    async getHistory(user: string) {
        return Game.db.collection(Collections.ActivityHistory).find({ user, date: { $gte: Game.now - HistoryLength } }).toArray();
    }

    async save(user: string, type: string, chain: string, data: any) {
        return Game.db.collection(Collections.ActivityHistory).insertOne({ user, date: Game.now, type, data, chain });
    }

    async update(filter: any, data: any) {
        return Game.db.collection(Collections.ActivityHistory).updateOne(filter, { $set: data });
    }
}