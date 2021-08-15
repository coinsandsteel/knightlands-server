import { MongoClient, Db, TransactionOptions, ReadPreference, ReadConcern, WriteConcern } from "mongodb";
import { ConnectionString } from "./database";

export class DatabaseClient {
    private _client: MongoClient;
    private _db: Db

    constructor() {
        const client = new MongoClient(ConnectionString);
        this._client = client;
    }

    get db() {
        return this._client.db("knightlands");;
    }

    async connect() {
        await this._client.connect();
    }

    async withoutTransaction(fn: (db: Db) => Promise<void>) {
        return fn(this.db);
    }

    async withTransaction(fn: (db: Db) => Promise<void>) {
        const session = this._client.startSession();
        // Step 2: Optional. Define options to use for the transaction
        const transactionOptions: TransactionOptions = {
            readPreference: new ReadPreference('primary'),
            readConcern: new ReadConcern('local'),
            writeConcern: new WriteConcern('majority', 10)
        };
        // Step 3: Use withTransaction to start a transaction, execute the callback, and commit (or abort on error)
        // Note: The callback for withTransaction MUST be async and/or return a Promise.
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