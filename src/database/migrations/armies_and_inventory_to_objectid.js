import { DatabaseClient } from "../Client";
import { Collections } from '../database';

async function run() {
  const client = new DatabaseClient();
  await client.connect();
  
  const db = client.db;
  console.log("Connected to db", db.databaseName);
  
  await swapIDs(Collections.Armies, db);
  await swapIDs(Collections.Inventory, db);
  
  process.exit(1);
}

async function swapIDs(collectionName, db) {
  const result = await db.collection(collectionName).find().forEach(async (entry) => {
    let address = entry._id;

    // Protect processed entries from being deleted
    if (!/@/.test(address) && !/\./.test(address)) {
      console.log(`${collectionName}: ${address} is not an email. Aborting.`);
      return;
    }

    // Retrieve user
    let user = await db.collection(Collections.Users).findOne({ address });

    // Check user existance
    if (!user) {
      await db.collection(collectionName).deleteOne({ _id: address });
      return;
    }

    let userObjectId = user._id;
    // Set new id to existing entry
    entry._id = userObjectId;

    // Insert new entry
    await db.collection(collectionName).insertOne(entry);
    // Delete old entry
    await db.collection(collectionName).deleteOne({ _id: address });

    console.log(`Migrated ${collectionName} entry: ${address} > ${userObjectId}`);
  });
};

// node -r esm -r ts-node/register src/database/migrations/armies_and_inventory_to_objectid.js
run();