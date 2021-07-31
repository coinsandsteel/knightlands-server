import { MongoClient, Db } from "mongodb";
import { ConnectionString } from "./database";

export class DatabaseClient {
    // private _client: MongoClient;
    // private _db: Db

    // constructor() {
    //     const client = new MongoClient(ConnectionString, {
    //         useNewUrlParser: true
    //     });
    //     this._client = client;
    //     this._db = client.db();
    // }

    // async connect() {

    // }

    // async run(fn) {
    //     const session = this.client.startSession();
    //     // Step 2: Optional. Define options to use for the transaction
    //     const transactionOptions = {
    //         readPreference: 'primary',
    //         readConcern: { level: 'local' },
    //         writeConcern: { w: 'majority' }
    //     };
    //     // Step 3: Use withTransaction to start a transaction, execute the callback, and commit (or abort on error)
    //     // Note: The callback for withTransaction MUST be async and/or return a Promise.
    //     try {
    //         await session.withTransaction(async () => {
    //             await fn(this.db)
    //         }, transactionOptions);
    //     } finally {
    //         await session.endSession();
    //         await this.client.close();
    //     }
    // }
}