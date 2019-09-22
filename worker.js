'use strict';

const Config = require("./config");
const SCWorker = require('socketcluster/scworker');
const express = require('express');
const serveStatic = require('serve-static');
const path = require('path');
const morgan = require('morgan');
const healthChecker = require('sc-framework-health-check');
const cors = require('cors');
const Operations = require("./knightlands-shared/operations");
const MongoClient = require("mongodb").MongoClient;

const Database = require("./database");

const LootGenerator = require("./lootGenerator");
const CraftingQueue = require("./crafting/craftingQueue");
const RaidManager = require("./raids/raidManager");
const IAPExecutor = require("./payment/IAPExecutor");
const PaymentProcessor = require("./payment/paymentProcessor");
const BlockchainFactory = require("./blockchain/blockchainFactory");
const CurrencyConversionService = require("./payment/CurrencyConversionService");
const Giveaway = require("./giveaway");
const Presale = require("./presale");
const UserPremiumService = require("./userPremiumService");

import DisconnectCodes from "./knightlands-shared/disconnectCodes";

import Game from "./game";

class Worker extends SCWorker {
  async run() {
    console.log('   >> Worker PID:', process.pid);
    var environment = this.options.environment;

    var app = express();

    var httpServer = this.httpServer;
    var scServer = this.scServer;

    if (environment === 'dev') {
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
    const client = new MongoClient(Database.ConnectionString, {
      useNewUrlParser: true
    });

    try {
      await client.connect();
      this._db = client.db();
      console.log("Connected to db", this._db.databaseName)
    } catch (err) {
      console.log("Can't connect to DB.", err.stack);
      throw err;
    }


    this._blockchain = BlockchainFactory(Config.blockchain, this._db);
    this._iapExecutor = new IAPExecutor(this._db);
    this._paymentProcessor = new PaymentProcessor(this._db, this._blockchain, this._iapExecutor);

    this._raidManager = new RaidManager(this._db, this._paymentProcessor);
    this._craftingQueue = new CraftingQueue(this._db);
    this._userPremiumService = new UserPremiumService(this._db);
    this._lootGenerator = new LootGenerator(this._db);

    await this._raidManager.init(this._iapExecutor);
    await this._craftingQueue.init(this._iapExecutor);
    await this._userPremiumService.init(this._iapExecutor);
    await this._lootGenerator.init(this._iapExecutor);

    
    this._currencyConversionService = new CurrencyConversionService(Config.blockchain, Config.conversionService);

    Game.init(
      scServer, 
      this._db, 
      this._blockchain, 
      this._paymentProcessor, 
      this._raidManager, 
      this._lootGenerator, 
      this._currencyConversionService, 
      this._craftingQueue,
      this._userPremiumService
    );

    this._giveaway = new Giveaway(app);
    this._presale = new Presale(app);

    await this._presale.init();
    await this._blockchain.start();
    await this._paymentProcessor.start();

    scServer.on("connection", socket => {
      Game.handleIncomingConnection(socket);
    });
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

    this.scServer.addMiddleware(this.scServer.MIDDLEWARE_SUBSCRIBE, async (req) => {
      let authToken = req.socket.authToken;

      if (authToken && authToken.address) {
        if (req.channel.substr(0, 4) === "raid") {
          // check if user is part of the raid
          let user = await Game.loadUser(authToken.address);
          if (!user) {
            req.socket.disconnect(DisconnectCodes.NotAuthorized);
            throw 'You are not authorized';
          }

          let raidId = req.channel.substr(5);
          let raid = Game.raidManager.getRaid(raidId);
          if (!raid) {
            req.socket.disconnect(DisconnectCodes.NotAllowed);
            throw 'incorrect raid';
          }

          // if (!raid.isParticipant(user.address)) {
          //   req.socket.disconnect(DisconnectCodes.NotAllowed);
          //   throw 'not participant';
          // }
        }
      } else if (req.channel != 'presale') {
        req.socket.disconnect(DisconnectCodes.NotAuthorized);
        throw 'You are not authorized';
      }
    });

    this.scServer.addMiddleware(this.scServer.MIDDLEWARE_PUBLISH_IN, (req, next) => {
      next('not allowed');
    });
  }
}

new Worker();