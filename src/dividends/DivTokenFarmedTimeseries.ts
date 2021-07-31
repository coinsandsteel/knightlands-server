import { Db, Collection } from "mongodb";
import { Collections } from "../database/database";
import { Lock } from "../utils/lock";
import { DividendsRegistry } from "./DividendsRegistry";

const Config = require("../config");

const LOCK_KEY = "div_farmed";

export class DivTokenFarmedTimeseries {
    private _db: Db;
    private _collection: Collection;
    private _lock: Lock;
    private _dividendsRegistry: DividendsRegistry;

    constructor(db: Db, dividendsRegistry: DividendsRegistry) {
        this._db = db;
        this._dividendsRegistry = dividendsRegistry;
        this._collection = this._db.collection(Collections.DivTokenFarmed);
        this._lock = new Lock();
    }

    async insertTokens(amount: number) {
        await this._lock.acquire(LOCK_KEY);
        try {
            await this._collection.updateOne({ "date": new Date() }, { $inc: { amount } }, { upsert: true });
            await this._dividendsRegistry.increaseSupply(amount);
        } finally {
            this._lock.release(LOCK_KEY);
        }
    }

    async getMA(periodLength) {
        const startDate = new Date(Date.now() - periodLength * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const records = await this._collection.find({ date: { $lte: endDate, $gte: startDate } }).toArray();

        if (records.length == 0) {
            // nothing was farmed
            return Config.game.minTourneyDkt;
        }

        let totalFarmed = 0;
        for (let i = 0; i < records.length; ++i) {
            totalFarmed += records[i].amount;
        }

        let ma = totalFarmed / records.length;

        if (ma < Config.game.minTourneyDkt) {
            ma = Config.game.minTourneyDkt;
        }

        return ma;
    }
}
