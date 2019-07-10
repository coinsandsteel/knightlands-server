var SCWorker = require('socketcluster/scworker');
var express = require('express');
var serveStatic = require('serve-static');
var path = require('path');
var morgan = require('morgan');
var healthChecker = require('sc-framework-health-check');

const Operations = require("./knightlands-shared/operations");
const PlayerController = require("./playerController");
const MongoClient = require("mongodb").MongoClient;

var db

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

    const url = 'mongodb://localhost:27017/knightlands';
    // Database Name
    const dbName = 'knightlands';
    const client = new MongoClient(url, {
      useNewUrlParser: true
    });

    try {
      await client.connect();
      db = client.db(dbName);
      console.log("Connected to db", db.databaseName)
    } catch (err) {
      console.log("Can't connect to DB.", err.stack);
      throw err;
    }

    scServer.on("connection", socket => {
      new PlayerController(socket, db)
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