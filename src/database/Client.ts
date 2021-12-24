import { MongoClient, Db, TransactionOptions, ReadPreference, ReadConcern, WriteConcern } from "mongodb";
import { ConnectionString, Collections } from "./database";

export class DatabaseClient {
    private _client: MongoClient;

    constructor({
        overrideUri = null
    } = {}) {
        const uri = overrideUri ? overrideUri : process.env.MONGO_URI ? process.env.MONGO_URI : ConnectionString;
        const client = new MongoClient(uri);
        this._client = client;
    }

    get db() {
        return this._client.db(process.env.DB_NAME || "knightlands");
    }

    async connect() {
        await this._client.connect();
    }

    async ensureIndex() {
        await this.db.collection(Collections.TournamentTables).createIndex({ tableId: 1, "records.id": 1 }, { unique: true });
        await this.db.collection(Collections.TournamentTables).createIndex({ tableId: 1, "records.score": -1 });

        await this.db.collection(Collections.RaceTables).createIndex({ tableId: 1, "records.id": 1 }, { unique: true });
        await this.db.collection(Collections.RaceTables).createIndex({ tableId: 1, "records.score": -1 });

        await this.db.collection(Collections.Users).createIndex({ address: 1 }, { unique: true });

        await this.db.collection(Collections.Inventory).createIndex({ "items.template": 1, "items.id": 1 });

        await this.db.collection(Collections.Armies).createIndex({ "units.id": 1 });

        await this.db.collection(Collections.ActivityHistory).createIndex({ user: 1, date: 1, "data.pending": 1, type: 1, chain: 1, "data.deadline": 1 });
    }

    async withoutTransaction(fn: (db: Db) => Promise<void>) {
        return fn(this.db);
    }

    async withTransaction(fn: (db: Db) => Promise<void>) {
        const session = this._client.startSession();

        const transactionOptions: TransactionOptions = {
            readPreference: new ReadPreference('primary'),
            readConcern: new ReadConcern('local'),
            writeConcern: new WriteConcern('majority', 5000)
        };
        let fnResult;
        try {
            await session.withTransaction(async () => {
                fnResult = await fn(this.db)
            }, transactionOptions);
            return fnResult;
        } catch (exc) {
            throw exc;
        } finally {
            await session.endSession();
        }
    }
}