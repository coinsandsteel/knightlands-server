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

    const items = {};
    const equipments = {};
    const amulets = {};
    const rings = {}
    let totalShinies = 0;

    const prices = {
        ["epic"]: 1100,
        ["legendary"]: 1650,
        ["mythical"]: 2500
    };

    const enchant = {
        ["epic"]: [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190],
        ["legendary"]: [75, 95, 115, 135, 155, 175, 195, 215, 235, 255, 275, 295, 315, 335, 355],
        ["mythical"]: [200, 235, 270, 305, 340, 375, 410, 445, 480, 515, 550]
    }

    const perUser = JSON.parse(fs.readFileSync("perUser").toString())

    for (const userId in perUser) {
        const shinies = perUser[userId];
        if (!shinies) {
            continue;
        }

        const inv = await db.collection("inventory").findOne({ _id: new ObjectId(userId) })
        await db.collection("inventory").updateOne({ _id: new ObjectId(userId) }, { $inc: { "currencies.hard": inv.currencies.shinies } });
    }

    // await db.collection("users").find({}, { projection: { character: 1, _id: 1 } }).forEach(entry => {
    //     const userId = entry._id.toString();
    //     const equipment = entry.character.equipment;
    //     if (!equipment.ring && !equipment.necklace) {
    //         return;
    //     }

    //     let shinies = 0;
    //     items[userId] = [];

    //     if (equipment.ring && prices[equipment.ring.rarity]) {
    //         shinies += prices[equipment.ring.rarity];
    //         items[userId].push(equipment.ring.id);
    //         rings[userId] = equipment.ring.id;
    //         delete equipment.ring;
    //     }

    //     if (equipment.necklace && prices[equipment.necklace.rarity]) {
    //         shinies += prices[equipment.necklace.rarity];
    //         items[userId].push(equipment.necklace.id);
    //         amulets[userId] = equipment.necklace.id;
    //         delete equipment.necklace;
    //     }

    //     equipments[userId] = equipment;
    //     perUser[userId] = shinies * 1.05;
    //     totalShinies += shinies;
    // })

    // for (const userId in perUser) {
    //     const shinies = perUser[userId];
    //     if (!shinies) {
    //         continue;
    //     }

    //     const ids = items[userId];

    //     const _items = await db.collection("inventory").aggregate([{
    //         $match: {
    //             "_id": new ObjectId(userId)
    //         }
    //     },
    //     {
    //         $project: {
    //             items: {
    //                 $filter: {
    //                     input: "$items",
    //                     as: "item",
    //                     cond: {
    //                         $in: ["$$item.id", ids]
    //                     }
    //                 }
    //             }
    //         }
    //     },
    //     {
    //         $project: {
    //             _id: 0
    //         }
    //     }
    //     ]).toArray();

    //     let flesh = 0;
    //     for (const item of _items[0].items) {
    //         if (!item.enchant) {
    //             continue;
    //         }

    //         for (let i = 0; i < item.enchant; ++i) {
    //             flesh += (enchant[item.rarity][i] / 0.75 / 100);
    //         }
    //     }

    //     await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { "character.equipment": equipments[userId] } });
    //     await db.collection("inventory").updateOne({ _id: new ObjectId(userId) }, { $inc: { "currencies.shinies": shinies, "currencies.dkt": flesh * 1.3 } });
    // }

    // for (const userId in rings) {
    //     const id = rings[userId];
    //     if (!id) {
    //         continue;
    //     }

    //     await db.collection("inventory").updateOne({ _id: new ObjectId(userId) }, { $pull: { items: { id } } });
    // }

    // for (const userId in amulets) {
    //     const id = amulets[userId];
    //     if (!id) {
    //         continue;
    //     }

    //     await db.collection("inventory").updateOne({ _id: new ObjectId(userId) }, { $pull: { items: { id } } });
    // }

    // fs.writeFileSync("perUser", JSON.stringify(perUser, null, 2));
    console.log('totalShinies', totalShinies)

    process.exit(1);
}

// node -r ts-node/register src/database/scripts/reset_accessories.ts
run();