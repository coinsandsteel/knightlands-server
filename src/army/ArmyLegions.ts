import { Legion } from "./ArmyTypes";
import { Db } from "mongodb";
import { Collections } from "../database/database";
import { string } from "random-js";

export class ArmyLegions {
    private _db: Db;
    private _cache: { [key: string]: Legion[] };

    constructor(db: Db) {
        this._db = db;
        this._cache = {};
    }

    resetCache(userId: string) {
        delete this._cache[userId];
    }

    async getLegion(userId: string, legionIndex: number) {
        if (!this._cacheExists(userId)) {
            const userRecord = await this._db.collection(Collections.Armies).findOne(
                { _id: userId },
                { projection: { "legions": 1 } }
            );

            if (userRecord) {
                this._cache[userId] = userRecord.legions;
            } else {
                this._cache[userId] = this.createLegions();
            }
        }

        const legions = this._cache[userId];
        return legions[legionIndex];
    }

    async onLegionUpdated(userId: string, legion: Legion) {
        await this._db.collection(Collections.Armies).updateOne(
            { _id: userId },
            { $set: { [`legions.${legion.index}`]: legion } }
        )
    }

    public createLegions() {
        let legions: Legion[] = [];
        // create 5 legions
        for (let i = 0; i < 5; ++i) {
            legions.push({
                units: {},
                index: i
            });
        }
        return legions;
    }

    private _cacheExists(userId: string) {
        return !!this._cache[userId];
    }
}
