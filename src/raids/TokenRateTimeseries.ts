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
        let queryResult = await this._db.collection(Collections.DivTokenRateTimeseries).find({ raidTemplateId }).sort({ t: -1 }).limit(1).toArray();
        const latestEntry = queryResult[0];
        latestEntry.r = rate;
        await this._db.collection(Collections.DivTokenRateTimeseries).updateOne({ _id: latestEntry._id }, { $set: latestEntry });
        // let know connected clients that current rate has changed
        Game.publishToChannel(`${Events.TokenChartUpdate}_${raidTemplateId}`, {
            raid: raidTemplateId,
            r: latestEntry.r,
            t: latestEntry.t
        });
    }

    async insertRates(queries: InsertQuery[]) {
        console.log(Collections.DivTokenRateTimeseries)
        await this._db.collection(Collections.DivTokenRateTimeseries).bulkWrite(queries);

        for (const query of queries) {
            // let know connected clients that current rate has changed
            Game.publishToChannel(`${Events.TokenChartUpdate}_${query.insertOne.raidTemplateId.toString()}`, {
                raid: query.insertOne.raidTemplateId,
                r: query.insertOne.r,
                t: query.insertOne.t
            });
        }
    }

    async query(raidTemplateId, from, to) {
        return await this._db.collection(Collections.DivTokenRateTimeseries)
            .find(
                {
                    raidTemplateId: raidTemplateId,
                    t: { $lt: to, $gte: from }
                }).sort({ t: 1 }).toArray();
    }
}

// at checkCollectionName(/srv/knightlands - server / node_modules / mongodb / lib / utils.js: 99: 11)
// 0 | knightla | at new Collection(/srv/knightlands - server / node_modules / mongodb / lib / collection.js: 104: 3)
// 0 | knightla | at Db.collection(/srv/knightlands - server / node_modules / mongodb / lib / db.js: 431: 26)
// 0 | knightla | at TokenRateTimeseries.<anonymous>(/srv/knightlands - server / src / raids / tokenRateTimeseries.ts: 34: 24)
// 0 | knightla | at Generator.next(<anonymous>)
// 0 | knightla | at / srv / knightlands - server / src / raids / tokenRateTimeseries.ts: 8: 71
// 0 | knightla | at new Promise(<anonymous>)
// 0 | knightla | at __awaiter(/srv/knightlands - server / src / raids / tokenRateTimeseries.ts: 4: 12)
// 0 | knightla | at TokenRateTimeseries.insertRates(/srv/knightlands - server / src / raids / tokenRateTimeseries.ts: 38: 16)
// 0 | knightla | at RaidManager.<anonymous>(/srv/knightlands - server / src / raids / raidManager.js: 587: 35) name: 'MongoError', [Symbol(mongoErrorContextSymbol)]: { }
