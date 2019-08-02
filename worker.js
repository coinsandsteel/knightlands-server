'use strict';

const Config = require("./config");
const SCWorker = require('socketcluster/scworker');
const express = require('express');
const serveStatic = require('serve-static');
const path = require('path');
const morgan = require('morgan');
const healthChecker = require('sc-framework-health-check');

const Operations = require("./knightlands-shared/operations");
const PlayerController = require("./playerController");
const MongoClient = require("mongodb").MongoClient;

const Database = require("./database");

const LootGenerator = require("./lootGenerator");
const RaidManager = require("./raids/raidManager");
const IAPExecutor = require("./payment/IAPExecutor");
const PaymentProcessor = require("./payment/paymentProcessor");
const BlockchainFactory = require("./blockchain/blockchainFactory");

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

    this._raidManager = new RaidManager(this._db);

    await this._raidManager.init(this._iapExecutor);

    this._lootGenerator = new LootGenerator(this._db);

    // proceed everything that was suppose to finish
    await this._paymentProcessor.proceedPayments();

    scServer.on("connection", socket => {
      new PlayerController(socket, this._db, this._blockchain, this._lootGenerator, this._raidManager, this._paymentProcessor);
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
      } else {
        req.socket.disconnect();
        next('You are not authorized');
      }
    });
  }
}

new Worker();