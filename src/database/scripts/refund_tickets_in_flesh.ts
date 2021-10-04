import fs from "fs";
import { ObjectId } from "mongodb";
import { DatabaseClient } from "../Client";
import { Collections } from '../database';

async function run() {
    const client = new DatabaseClient();
    await client.connect();

    const db = client.db;
    console.log("Connected to db", db.databaseName);

    const perUser = {};

    await db.collection("payment_requests").find({
        iap: {
            $in: [
                "r_tickets_2",
                "r_tickets_10",
                "r_tickets_25",
                "r_tickets_100",
                "r_tickets_250",
                "r_tickets_1000"
            ]
        }, claimed: true
    }).forEach(entry => {
        const userId = entry.userId.toString();
        if (!perUser[userId]) {
            perUser[userId] = 0;
        }
        let tickets = 0;

        switch (entry.iap) {
            case "r_tickets_2":
                tickets = 2;
                break;
            case "r_tickets_10":
                tickets = 10;
                break;
            case "r_tickets_25":
                tickets = 25;
                break;
            case "r_tickets_100":
                tickets = 100;
                break;
            case "r_tickets_250":
                tickets = 250;
                break;
            case "r_tickets_1000":
                tickets = 1000;
                break;
        }

        perUser[userId] += tickets;
    });

    await db.collection("presale_card_deposits").find({ pending: false }).forEach(entry => {
        const userId = entry.user.toString();
        const type = (BigInt(entry.tokenIds[0]) >> BigInt(128)).toString();

        if (!perUser[userId]) {
            perUser[userId] = 0;
        }

        let tickets = 0;

        switch (type) {
            case "3":
                tickets = 25;
                break;

            case "2":
                tickets = 10;
                break;

            case "1":
                tickets = 2;
                break;
        }

        perUser[userId] += tickets;
    });

    const users = []
    for (const id in perUser) {
        users.push(new ObjectId(id));
    }

    let totalFLESH = 0

    await db.collection("inventory").find({ _id: { $in: users } }, { projection: { items: 1, _id: 1 } }).forEach(entry => {
        const userId = entry._id.toString();
        const item = entry.items.find(x => x.template == 3110);
        if (item) {
            console.log("found tickets", item.count)
            perUser[userId] -= item.count;
        }

        perUser[userId] *= 1;
        totalFLESH += perUser[userId];
    })

    for (const userId in perUser) {
        const flesh = perUser[userId];
        await db.collection("inventory").updateOne({ _id: new ObjectId(userId) }, { $inc: { "currencies.dkt": flesh } });
        console.log('done', userId)
    }

    fs.writeFileSync("perUser", JSON.stringify(perUser, null, 2));

    process.exit(1);
}

// node -r ts-node/register src/database/scripts/count_tickets_used.ts
run();