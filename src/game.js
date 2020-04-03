'use strict';

const User = require("./user");
import EventEmitter from 'events';
const PlayerController = require("./playerController");
const ItemTemplates = require("./itemTemplates");
const { Collections } = require("./database");
import DisconnectCodes from "./knightlands-shared/disconnectCodes";

class Game extends EventEmitter {
    constructor() {
        super();
    }

    init(
        server, 
        db, 
        blockchain, 
        paymentProcessor, 
        raidManager, 
        lootGenerator, 
        currencyConversionService, 
        craftingQueue,
        userPremiumService,
        dividends,
        rankings
    ) {
        this._server = server;
        this._db = db;
        this._blockchain = blockchain;
        this._paymentProcessor = paymentProcessor;
        this._raidManager = raidManager;
        this._lootGenerator = lootGenerator;
        this._currencyConversionService = currencyConversionService;
        this._craftingQueue = craftingQueue;
        this._itemTemplates = new ItemTemplates(db);
        this._userPremiumService = userPremiumService;
        this._dividends = dividends;
        this._rankings = rankings;

        this._players = {};
    }

    get rankings() {
        return this._rankings;
    }

    get dividends() {
        return this._dividends;
    }

    get db() {
        return this._db;
    }

    get userPremiumService() {
        return this._userPremiumService;
    }

    get craftingQueue() {
        return this._craftingQueue;
    }

    get itemTemplates() {
        return this._itemTemplates;
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

    publishToChannel(name, data) {
        this._server.exchange.publish(name, data);
    }

    get now() {
        return new Date().getTime();
    }

    get nowSec() {
        return Math.floor(this.now / 1000); 
    }

    async _getExpTable() {
        let table = await this._db.collection(Collections.ExpTable).findOne({
            _id: 1
        });
        return table.player;
    }

    async _getMeta() {
        return await this._db.collection(Collections.Meta).findOne({
            _id: "meta"
        });
    }

    async loadUser(address) {
        let expTable = await this._getExpTable();
        let meta = await this._getMeta();
        let user = new User(address, this._db, expTable, meta);
        await user.load();

        return user;
    }

    async getUser(address) {
        let playerController = this.getPlayerController(address);
        let user;
        if (playerController) {
            user = await playerController.getUser();
        } else {
            user = await this.loadUser(address);
        }

        return user;
    }

    async loadInventory(address) {
        const user = await this.getUser(address);
        return user.inventory;
    }

    getPlayerController(userId) {
        return this._players[userId];
    }

    emitPlayerEvent(userId, event, args) {
        this.emit(userId, event, args);
    }

    handleIncomingConnection(socket) {
        let controller = new PlayerController(socket);

        socket.on("authenticate", async () => {
            console.log("client authenticated", controller.address);
            // check if player is whitelisted
            let whitelisted = await this.db.collection(Collections.Whitelist).findOne({wallet: controller.address});
            if (!whitelisted) {
                controller.socket.disconnect(DisconnectCodes.NotAllowed, "not whitelisted");
                return;
            }

            if (!controller.address) {
                // socket was disconnected before whitelisting query finished
                return;
            }

            // if there is previous controller registered - disconnect it and remove
            let connectedController = this._players[controller.address];
            if (connectedController) {
                connectedController.socket.disconnect(DisconnectCodes.OtherClientSignedIn, "other account connected");
            }

            this._paymentProcessor.registerAsPaymentListener(controller.address, controller);
            this._players[controller.address] = controller;

            controller.onAuthenticated();
        });

        socket.on("deauthenticate", () => {
            console.log("client deauthenticate", controller.address);
            this._deletePlayerController(controller);

            controller.onDisconnect();
        });

        socket.on("close", () => {
            console.log("client close", controller.address);

            this._deletePlayerController(controller);

            controller.onDisconnect();
        });
    }

    _deletePlayerController(controller) {
        if (controller.address) {
            this._paymentProcessor.unregister(controller.address, controller);
            delete this._players[controller.address];
        }
    }
}

const game = new Game();

export default game;