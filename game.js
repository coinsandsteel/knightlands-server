'use strict';

const EventEmitter = require('events');
const PlayerController = require("./playerController");

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