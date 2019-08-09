'use strict';

const User = require("./user");
const EventEmitter = require('events');
const PlayerController = require("./playerController");
const Inventory = require("./inventory");
const { Collections } = require("./database");

class Game extends EventEmitter {
    constructor() {
        super();
    }

    init(db, blockchain, paymentProcessor, raidManager, lootGenerator, currencyConversionService) {
        this._db = db;
        this._blockchain = blockchain;
        this._paymentProcessor = paymentProcessor;
        this._raidManager = raidManager;
        this._lootGenerator = lootGenerator;
        this._currencyConversionService = currencyConversionService;

        this._players = {};

        // forbid further creation
        // delete this.init;
        // delete this.constructor;
    }

    get db() {
        return this._db;
    }

    get blockchain() {
        return this._blockchain;
    }

    get paymentProcessor() {
        return this._paymentProcessor;
    }

    get raidManager() {
        return this._raidManager;
    }

    get lootGenerator() {
        return this._lootGenerator;
    }

    get currencyConversionService() {
        return this._currencyConversionService;
    }

    async _getExpTable() {
        let table = await this._db.collection(Collections.ExpTable).findOne({
            _id: 1
        });
        return table.player;
    }

    async _getMeta() {
        return await this._db.collection(Collections.Meta).findOne({
            _id: 0
        });
    }

    async loadUser(address) {
        let expTable = await this._getExpTable();
        let meta = await this._getMeta();
        let user = new User(address, this._db, expTable, meta);

        await user.load();

        return user;
    }

    async loadInventory(userId) {
        // load player inventory. If player online - use loaded inventory. Or load inventory directly;
        let userInventory;
        let playerOnline = this.getPlayerController(userId);
        if (playerOnline) {
            userInventory = (await playerOnline.getUser()).inventory;
        } else {
            userInventory = new Inventory(userId, this._db);
        }

        return userInventory;
    }

    getPlayerController(userId) {
        return this._players[userId];
    }

    emitPlayerEvent(userId, event, args) {
        this.emit(userId, event, args);
    }

    handleIncomingConnection(socket) {
        let controller = new PlayerController(socket);

        socket.on("authenticate", () => {
            this._paymentProcessor.registerAsPaymentListener(controller.address, controller);
            this._players[controller.address] = controller;

            controller.onAuthenticated();
        });

        socket.on("deauthenticate", () => {
            this._deletePlayerController(controller);
        });

        socket.on("disconnect", () => {
            this._deletePlayerController(controller);

            controller.onDisconnect();
        });
    }

    _deletePlayerController(controller) {
        if (controller.address) {
            this._paymentProcessor.unregister(controller.address);
            delete this._players[controller.address];
        }
    }
}

const game = new Game();

export default game;