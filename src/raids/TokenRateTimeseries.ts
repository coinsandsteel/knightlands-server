import { Db } from "mongodb";
import { Collections } from "../database";
const Events = require("./../knightlands-shared/events");
import Game from "../game";

type InsertQuery = {
    insertOne: {
        raidTemplateId: number, r: number, t: number
    }
}

export class TokenRateTimeseries {
    private _db: Db;

    constructor(db: Db) {
        this._db = db;
    }

    async updateRate(raidTemplateId: number, rate: number) {
        // update latest data point
        let queryResult = await this._db.collection(Collections.DivTokenTimeseries).find({ raidTemplateId }).sort({ t: -1 }).limit(1).toArray();
        const latestEntry = queryResult[0];
        latestEntry.r = rate;
        await this._db.collection(Collections.DivTokenTimeseries).updateOne({ _id: latestEntry._id }, { $set: latestEntry });
        // let know connected clients that current rate has changed
        Game.publishToChannel(`${Events.TokenChartUpdate}_${raidTemplateId}`, {
            raid: raidTemplateId,
            r: latestEntry.r,
            t: latestEntry.t
        });
    }

    async insertRates(queries: InsertQuery[]) {
        await this._db.collection(Collections.DivTokenTimeseries).bulkWrite(queries);

        for (const query of queries) {
            // let know connected clients that current rate has changed
            Game.publishToChannel(`${Events.TokenChartUpdate}_${query.insertOne.raidTemplateId}`, {
                raid: query.insertOne.raidTemplateId,
                r: query.insertOne.r,
                t: query.insertOne.t
            });
        }
    }

    async query(raidTemplateId, from, to) {
        return await this._db.collection(Collections.DivTokenTimeseries)
            .find(
                {
                    raidTemplateId: raidTemplateId,
                    t: { $lt: to, $gte: from }
                }).sort({ t: 1 }).toArray();
    }
}
