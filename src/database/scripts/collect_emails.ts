import fs from "fs";
import { DatabaseClient } from "../Client";
import { Collections } from '../database';

async function run() {
    const client = new DatabaseClient();
    await client.connect();

    const db = client.db;
    console.log("Connected to db", db.databaseName);

    const newLine = "\r\n";
    let csvContent = "email" + newLine;
    const emails = [];

    await db.collection(Collections.Users).find({}).forEach(entry => {
        emails.push(entry.address);
    });

    csvContent += emails.join(newLine);

    fs.writeFileSync("./emails.csv", csvContent);

    process.exit(1);
}

// node -r ts-node/register src/database/scripts/collect_emails.ts
run();