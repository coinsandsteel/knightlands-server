import { Collections } from "../database/database";
import { Db, Collection } from "mongodb";
import { ArmyUnit, ArmyReserve } from "./ArmyTypes";
import Game from "../game";
import Events from "../knightlands-shared/events";
import { ObjectId } from "mongodb";
import User from "../user";

type ArmyInventory = { [key: string]: ArmyUnit };

type CacheRecord = {
    unitsLookup: ArmyInventory,
    reserve: ArmyReserve,
    units: ArmyUnit[]
}

export class ArmyUnits {
    private _db: Db;
    private _cache: { [key: string]: CacheRecord };
    private _collection: Collection;

    constructor(db: Db) {
        this._db = db;
        this._cache = {};
        this._collection = this._db.collection(Collections.Armies);
    }

    getReserveKey(unit: { template: number, promotions: number }) {
        return `${unit.template}_${unit.promotions}`;
    }

    async getReservedUnits(userId: ObjectId, units: ArmyUnit[]): Promise<ArmyReserve> {
        const length = units.length;
        const reserve = await this.getReserve(userId);
        const foundReserves = {};
        for (let i = 0; i < length; ++i) {
            const key = this.getReserveKey(units[i]);
            if (reserve[key]) {
                foundReserves[key] = reserve[key];
            }
        }
        return foundReserves;
    }

    async getUserUnits(userId: ObjectId, ids: number[]) {
        return this.getInventoryUnits(userId, ids);
    }

    async getUserUnit(userId: ObjectId, id: number) {
        return this.getInventoryUnits(userId, [id]);
    }

    async onUnitUpdated(user: User, unit: ArmyUnit) {
        await this._collection.updateOne(
            { _id: user.id, "units.id": unit.id },
            { $set: { "units.$": unit } }
        );

        Game.emitPlayerEvent(user.address, Events.UnitUpdated, unit);
        this.resetCache(user.id);
    }

    async addUnits(userId: ObjectId, units: ArmyUnit[], lastUnitId: number, lastSummon: number | undefined = undefined) {
        let $set: any = { lastUnitId }
        if (lastSummon) {
            $set.lastSummon = lastSummon;
        }
        await this._collection.updateOne({ "_id": userId }, { $push: { "units": { $each: units } }, $set, $inc: { "occupiedSlots": units.length } }, { upsert: true });
    }

    async removeUnits(userId: ObjectId, ids: number[]) {
        await this._collection.updateOne(
            { "_id": userId },
            { $pull: { "units": { "id": { $in: ids } } }, $inc: { "occupiedSlots": -ids.length } }
        );

        Game.emitPlayerEvent(userId, Events.UnitsRemoved, ids);
        this.resetCache(userId);
    }

    async updateReservedUnits(user: User, reserve: ArmyReserve) {
        const setQuery = {};
        for (let key in reserve) {
            setQuery[`reserve.${key}`] = reserve[key];
        }
        await this._collection.updateOne(
            { _id: user.id },
            { $set: setQuery }
        );

        Game.emitPlayerEvent(user.address, Events.UnitsReserveUpdate, reserve);
        this.resetCache(user.id);
    }

    async getInventory(userId: ObjectId) {
        const { units } = await this.getCache(userId);
        return units;
    }

    async getReserve(userId: ObjectId) {
        const { reserve } = await this.getCache(userId);
        return reserve;
    }

    resetCache(userId: ObjectId) {
        delete this._cache[userId.toHexString()];
    }

    private async getCache(userId: ObjectId): Promise<CacheRecord> {
        if (!this._cache[userId.toHexString()]) {
            // build an index
            let userRecord = await this._collection.findOne(
                { _id: userId }
            );

            if (userRecord) {
                const cacheRecord: CacheRecord = {
                    unitsLookup: {},
                    reserve: {},
                    units: userRecord.units
                };

                const length = userRecord.units.length;
                for (let i = 0; i < length; ++i) {
                    const unit = userRecord.units[i];
                    cacheRecord.unitsLookup[unit.id] = unit;
                }

                for (const key in userRecord.reserve) {
                    const unit = userRecord.reserve[key];
                    cacheRecord.reserve[key] = unit;
                }

                this._cache[userId.toHexString()] = cacheRecord;
            }
        }

        return this._cache[userId.toHexString()];
    }

    private async getInventoryUnits(userId: ObjectId, ids: number[]) {
        if (!ids || ids.length == 0) {
            return null;
        }

        const cacheRecord = await this.getCache(userId);
        const retrievedUnits: ArmyInventory = {};
        let someUnitFound = false;
        let i = 0;
        const length = ids.length;
        for (; i < length; ++i) {
            const unit = cacheRecord.unitsLookup[ids[i]];
            if (!unit) {
                continue;
            }

            retrievedUnits[unit.id] = unit;
            someUnitFound = true;
        }

        return someUnitFound ? retrievedUnits : null;
    }
}
