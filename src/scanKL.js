import { DatabaseClient } from "./database/Client";

// const PresaleChestGateway = require("./PresaleChestGateway.json");

const TronWeb = require("tronweb");

async function scan() {
    const client = new DatabaseClient()
    await client.connect();

    const provider = new TronWeb({
        fullHost: "https://api.trongrid.io",
        privateKey: "b7b1a157b3eef94f74d40be600709b6aeb538d6d8d637f49025f4c846bd18200"
    });
    // const presale = provider.contract(abi, "TUCnRiaydK4h9BMtYZXXjUwNBrDYoXp2FB");
    // const gateway = provider.contract(PresaleChestGateway.abi, "TAGCzgmuUGzfgNvaXKsztH9Kqk2rjwvJE4");
    let options = {
        eventName: "ChestPurchased",
        sort: "block_timestamp", // force to work since as intended - make a minimum point of time to scan events
        onlyConfirmed: true,
        size: 900,
        fromTimestamp: 1557096239,
        sinceTimestamp: 1557096239,
        page: 1
    };

    // get block 1 by 1 and search for events
    while (true) {
        let events = await provider.getEventResult("TUCnRiaydK4h9BMtYZXXjUwNBrDYoXp2FB", options);
        const length = events.length;
        if (length == 0) {
            break;
        }

        events.sort((x, y) => {
            return x.timestamp - y.timestamp;
        });

        let i = 0;
        for (; i < length; i++) {
            let eventData = events[i];
            if (eventData.name != "ChestPurchased") {
                continue;
            }

            options.sinceTimestamp = eventData.timestamp;
            options.fromTimestamp = eventData.timestamp;

            eventData.result.purchaser

            await client.db.collection("knightlands_presale").insertOne({
                tokenId: +eventData.result.chest,
                amount: +eventData.result.amount,
                owner: eventData.result.purchaser,
                address: eventData.contract
            })
        }

        options.page++;
        options.fingerPrint = events[length - 1]._fingerPrint;

        if (!options.fingerPrint) {
            break;
        }
    }

    // const owners = []

    // const totalSupply = +(await token.totalSupply())
    // console.log(totalSupply.toString())
    // for (let i = 0; i < totalSupply; ++i) {
    //     const tokenId = i + 1
    //     try {
    //         const owner = await token.ownerOf(tokenId)
    //         await client.db.collection("knightlands_presale").insertOne({ tokenId, owner, address: "0xf7aa404BAe09aD87660f84487526B5Ae6961841b" })
    //     } catch (e) {
    //         console.error(e)
    //     }
    // }

    process.exit(0)
}

scan()