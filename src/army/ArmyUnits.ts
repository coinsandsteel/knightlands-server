import { Collections } from "../database";
import { Db } from "mongodb";
import { ArmyUnit } from "./ArmyTypes";
import Game from "../game";
import Events from "../knightlands-shared/events";

export class ArmyUnits {
    private _db: Db;
    private _cache: { [key: string]: { [key: string]: ArmyUnit } };

    constructor(db: Db) {
        this._db = db;
        this._cache = {};
    }

    async getUserUnits(userId: string, ids: number[]) {
        return this.retrieveFromCache(userId, ids);
    }

    async getUserUnit(userId: string, id: number) {
        return this.retrieveFromCache(userId, [id]);
    }

    async onUnitUpdated(userId: string, unit: ArmyUnit) {
        await this._db.collection(Collections.Armies).updateOne(
            { _id: userId, "units.id": unit.id },
            { $set: { "units.$": unit } }
        );

        Game.emitPlayerEvent(userId, Events.UnitUpdated, unit);
    }

    async removeUnits(userId: string, ids: number[]) {
        await this._db.collection(Collections.Armies).updateOne(
            { _id: userId },
            { $pull: { "units": { "id": { $in: ids } } } }
        );
        const cache = this.getCache(userId);
        if (cache) {
            for (const id of ids) {
                delete cache[id];
            }
        }
        Game.emitPlayerEvent(userId, Events.UnitsRemoved, ids);
    }

    private getCache(userId: string) {
        return this._cache[userId];
    }

    private isCacheExist(userId: string) {
        return !!this.getCache(userId);
    }

    private async retrieveFromCache(userId: string, ids: number[]): Promise<{ [key: string]: ArmyUnit }> {
        if (!ids || ids.length == 0) {
            return null;
        }

        if (!this.isCacheExist(userId)) {
            let userRecord = await this._db.collection(Collections.Armies).findOne(
                { _id: userId }
            );

            // build an index
            if (userRecord) {
                const { units } = userRecord;

                const cacheRecord = {};
                let i = 0;
                const length = units.length;
                for (; i < length; ++i) {
                    const unit = units[i];
                    cacheRecord[unit.id] = unit;
                }

                if (length > 0) {
                    this._cache[userId] = cacheRecord;
                }
            }
        }

        if (!this.isCacheExist(userId)) {
            return null;
        }

        const cacheRecord = this.getCache(userId);
        const retrievedUnits = {};
        let someUnitFound = false;
        let i = 0;
        const length = ids.length;
        for (; i < length; ++i) {
            const unit = cacheRecord[ids[i]];
            if (!unit) {
                continue;
            }

            retrievedUnits[unit.id] = unit;
            someUnitFound = true;
        }

        return someUnitFound ? retrievedUnits : null;
    }
}
