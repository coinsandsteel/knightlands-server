'use strict';

const Config = require("./config");
const SCWorker = require("socketcluster/scworker");
const express = require("express");
const serveStatic = require("serve-static");
const path = require("path");
const morgan = require("morgan");
const healthChecker = require('sc-framework-health-check');
const cors = require('cors');
const Operations = require("./knightlands-shared/operations");

const LootGenerator = require("./lootGenerator");
const CraftingQueue = require("./crafting/craftingQueue");
const RaidManager = require("./raids/raidManager");
const IAPExecutor = require("./payment/IAPExecutor");
const PaymentProcessor = require("./payment/paymentProcessor");
const CurrencyConversionService = require("./payment/CurrencyConversionService");
const Giveaway = require("./giveaway");
const Presale = require("./presale");
const UserPremiumService = require("./userPremiumService");
import { ArmyManager } from "./army/ArmyManager";

import DisconnectCodes from "./knightlands-shared/disconnectCodes";

import Game from "./game";

import Rankings from "./rankings/Rankings";
import { Blockchain } from "./blockchain/Blockchain";
import Blockchains from "./knightlands-shared/blockchains";
import { Shop } from "./shop/Shop";
import { DatabaseClient } from "./database/Client";

process.on("unhandledRejection", (error) => {
    // if (process.env.ENV == 'dev') {
    console.error(error); // This prints error with stack included (as for normal errors)
    // }
});

class Worker extends SCWorker {
    async run() {
        console.log('   >> Worker PID:', process.pid);
        var environment = this.options.environment;

        var app = express();

        var httpServer = this.httpServer;
        var scServer = this.scServer;

        if (environment === 'dev' || environment === 'local') {
            // Log every HTTP request. See https://github.com/expressjs/morgan for other
            // available formats.
            app.use(morgan('dev'));
        }

        app.use(cors());
        app.use(express.json());
        app.use(serveStatic(path.resolve(__dirname, 'public')));

        // Add GET /health-check express route
        healthChecker.attach(this, app);

        httpServer.on('request', app);

        this.setupMiddleware()

        // Database Name
        const client = new DatabaseClient()

        try {
            await client.connect();
            await client.ensureIndex();
            this._db = client.db;
            console.log("Connected to db", this._db.databaseName)
        } catch (err) {
            console.log("Can't connect to DB.", err.stack);
            throw err;
        }


        this._blockchain = new Blockchain();
        this._iapExecutor = new IAPExecutor(this._db);
        this._paymentProcessor = new PaymentProcessor(this._db, this._blockchain, this._iapExecutor);

        this._raidManager = new RaidManager(this._db, this._paymentProcessor);
        this._craftingQueue = new CraftingQueue(this._db);
        this._userPremiumService = new UserPremiumService(this._db);
        this._lootGenerator = new LootGenerator(this._db);
        this._rankings = new Rankings(this._db);
        this._armyManager = new ArmyManager(this._db);
        this._shop = new Shop(this._paymentProcessor);

        this._currencyConversionService = new CurrencyConversionService();

        await Game.init(
            client,
            scServer,
            this._db,
            this._blockchain,
            this._paymentProcessor,
            this._raidManager,
            this._lootGenerator,
            this._currencyConversionService,
            this._craftingQueue,
            this._userPremiumService,
            this._rankings,
            this._armyManager,
            this._shop,
            this._iapExecutor
        );

        this._giveaway = new Giveaway(app);
        this._presale = new Presale(app);

        await this._shop.init(this._iapExecutor);
        await this._raidManager.init();
        await this._craftingQueue.init(this._iapExecutor);
        await this._userPremiumService.init(this._iapExecutor);
        await this._rankings.init();
        await this._presale.init();
        await this._blockchain.start();
        await this._paymentProcessor.start();
        await this._armyManager.init(this._iapExecutor);

        scServer.on("connection", socket => {
            Game.handleIncomingConnection(socket);
        });

        this.on('masterMessage', async(msg, respond) => {
            if (msg == 'terminate') {
                console.log('Application shutdown has started...');
                try {
                    // Shutdown connections
                    await Game.shutdown();
                    console.log('Existed connections closed.');

                    // Shutdown Ethereum blockchain
                    let ethereumBlockchain = Game.blockchain.getBlockchain(Blockchains.Ethereum);
                    await ethereumBlockchain.shutdown();
                    console.log('Blockchain stopped.');

                } catch (err) {
                    console.log(err);

                } finally {
                    console.log('Application stopped successfully!');
                }
            }

            respond(null, 'terminated');
        })
    }

    setupMiddleware() {
        this.scServer.addMiddleware(this.scServer.MIDDLEWARE_EMIT, (req, next) => {
            if (req.event == Operations.Auth) {
                next();
                return;
            }

            let authToken = req.socket.authToken;
            if (authToken && authToken.address) {
                next();
                return;
            } else {
                req.socket.disconnect(DisconnectCodes.NotAuthorized);
                next();
            }
        });

        // TODO: migrate to latest socketcluster
        // this.scServer.addMiddleware(this.scServer.MIDDLEWARE_SUBSCRIBE, async req => {
        //   let authToken = req.socket.authToken;

        //   if (authToken && authToken.address) {
        //     if (req.channel.substr(0, 4) === "raid") {
        //       // check if user participates in the raid
        //       let user = await Game.loadUser(authToken.address);
        //       if (!user) {
        //         req.socket.disconnect(DisconnectCodes.NotAuthorized);
        //         throw 'You are not authorized';
        //       }

        //       let raidId = req.channel.substr(5);
        //       let raid = Game.raidManager.getRaid(raidId);
        //       if (!raid) {
        //         req.socket.disconnect(DisconnectCodes.NotAllowed);
        //         throw 'incorrect raid';
        //       }

        //       // if (!raid.isParticipant(user.address)) {
        //       //   req.socket.disconnect(DisconnectCodes.NotAllowed);
        //       //   throw 'not participant';
        //       // }
        //     }
        //   } else if (req.channel != 'presale') {
        //     req.socket.disconnect(DisconnectCodes.NotAuthorized);
        //     throw 'You are not authorized';
        //   }
        // });

        this.scServer.addMiddleware(this.scServer.MIDDLEWARE_PUBLISH_IN, (req, next) => {
            next('not allowed');
        });
    }
}

new Worker();