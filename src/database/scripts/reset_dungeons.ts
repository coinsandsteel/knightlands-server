import fs from "fs";
import { ObjectId } from "mongodb";
import { DatabaseClient } from "../Client";
import { Collections } from '../database';

async function run() {
    const client = new DatabaseClient({
        overrideUri: "mongodb+srv://knightlands_prod:hkNpzPQrerFZUAXF2qPR@cluster0.9brud.mongodb.net/knightlands?retryWrites=true&w=majority"
    });
    await client.connect();

    const db = client.db;
    console.log("Connected to db", db.databaseName);

    // await db.collection(Collections.HalloweenUsers).updateOne({}, { $set: { "state.user.level": -1 } })

    console.log(
        await db.collection(Collections.HalloweenUsers).findOne({_id: new ObjectId('615471b66f38b41c05a8504a')})
    )


    process.exit(1);
}

// node -r ts-node/register src/database/scripts/reset_rp_mines.ts
run();