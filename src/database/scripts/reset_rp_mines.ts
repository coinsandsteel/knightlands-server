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

    const perUser = {};

    let totalFLESH = 0

    const priceBase = 1.5
    const priceFactor = 1.2

    await db.collection("users").find({}, { projection: { dividends: 1, _id: 1 } }).forEach(entry => {
        const userId = entry._id.toString();
        const mineLevel = entry.dividends.miningLevel;
        let fleshToRefund = 0;

        for (let i = 0; i < mineLevel; ++i) {
            const fiatPrice = Math.pow(priceBase * (i + 1), priceFactor) * 100;
            fleshToRefund += (fiatPrice / 0.75 / 100);
        }

        perUser[userId] = fleshToRefund;

        totalFLESH += perUser[userId];
    })

    for (const userId in perUser) {
        const flesh = perUser[userId];
        if (!flesh) {
            continue;
        }

        await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { "dividends.miningLevel": 0 } });
        await db.collection("inventory").updateOne({ _id: new ObjectId(userId) }, { $inc: { "currencies.dkt": flesh } });
    }



    console.log('totalFLESH', totalFLESH)

    // fs.writeFileSync("perUser", JSON.stringify(perUser, null, 2));

    process.exit(1);
}

// node -r ts-node/register src/database/scripts/reset_rp_mines.ts
run();