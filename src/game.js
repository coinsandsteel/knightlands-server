'use strict';

import User from "./user";
import EventEmitter from 'events';
const PlayerController = require("./playerController");
const ItemTemplates = require("./itemTemplates");
const AccessoryOptions = require('./accessoryOptions')
const { Collections } = require("./database/database");
import DisconnectCodes from "./knightlands-shared/disconnectCodes";
import { DivTokenFarmedTimeseries } from "./dividends/DivTokenFarmedTimeseries";
import { DividendsRegistry } from "./dividends/DividendsRegistry";
import { DepositGateway } from "./assets/DepositGateway";
import { Season } from './seasons/Season';
import { Lock } from './utils/lock';
import { ObjectId } from "mongodb";
import Inventory from "./inventory";
import { ActivityHistory } from './blockchain/ActivityHistory';
import { RaidPointsManager } from './raids/RaidPointsManager';
import { PrizePoolManager } from "./rankings/PrizePool/PrizePoolManager";
import { PresaleCardsService } from "./shop/PresaleCards";

class Game extends EventEmitter {
    constructor() {
        super();
    }

    async init(
        dbClient,
        server,
        db,
        blockchain,
        paymentProcessor,
        raidManager,
        lootGenerator,
        currencyConversionService,
        craftingQueue,
        userPremiumService,
        rankings,
        armyManager,
        shop
    ) {
        this.dbClient = dbClient;
        this.shop = shop;
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
        this._season = new Season();
        this._dividends = new DividendsRegistry(blockchain, this._season);
        this._rankings = rankings;
        this._armyManager = armyManager;
        this.tokenAmounts = new DivTokenFarmedTimeseries(db, this._dividends);
        this.depositGateway = new DepositGateway(blockchain);
        this.activityHistory = new ActivityHistory();
        this.accessoryOptions = new AccessoryOptions(db);
        this.raidPoints = new RaidPointsManager();
        this.prizePool = new PrizePoolManager();
        this.founderSale = new PresaleCardsService(blockchain);

        this._players = {};
        this._playersById = {};

        await this.lootGenerator.init();
        await this._season.init();
        await this._dividends.init();
        await this._season.checkSeason();
        await this.accessoryOptions.init();
        await this.raidPoints.init();
        await this.prizePool.init();
        await this.founderSale.init();

        this._lock = new Lock();
    }

    get armyManager() {
        return this._armyManager;
    }

    get rankings() {
        return this._rankings;
    }

    get dividends() {
        return this._dividends;
    }

    get season() {
        return this._season;
    }

    get db() {
        return this.dbClient.db;
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

    async loadUserPreview(id) {
        let items;
        let army;
        const user = await this._db.collection(Collections.Users).findOne({ _id: new ObjectId(id) }, { projection: { character: 1 } });
        if (user) {
            const equipmentIds = [];
            for (const slotId in user.character.equipment) {
                const item = user.character.equipment[slotId];
                equipmentIds.push(item.id);
            }

            army = await this.armyManager.getArmyPreview(user._id)

            if (army) {
                const lookup = {};
                const legion = army.legions[0];
                for (const slotId in legion.units) {
                    lookup[legion.units[slotId]] = true;
                }
                army.units = army.units.filter(x => {
                    if (lookup[x.id]) {
                        for (const slotId in x.items) {
                            equipmentIds[x.items[slotId].id]
                        }
                    }

                    return lookup[x.id];
                })
            }

            items = (await Inventory.loadItems(user._id, equipmentIds))[0];
        }

        return {
            user,
            items,
            army
        };
    }
    
    /**
     * @deprecated since 2021-09-27
     */
     async loadUser(address) {
        let expTable = await this._getExpTable();
        let meta = await this._getMeta();
        let user = new User(address, this._db, expTable, meta);
        await user.load();

        return user;
    }

    async loadUserById(id) {
        let expTable = await this._getExpTable();
        let meta = await this._getMeta();
        let user = new User(null, this._db, expTable, meta);
        await user.load(id);

        return user;
    }

    async getUserById(id) {
        await this._lock.acquire("get-user");

        let user;
        try {
            let playerController = this.getPlayerControllerById(id);
            if (playerController) {
                user = await playerController.getUser();
            } else {
                user = await this.loadUserById(id);
            }
        } finally {
            await this._lock.release("get-user");
        }

        return user;
    }

    /**
     * @deprecated since 2021-09-27
     */
     async getUser(address) {
        await this._lock.acquire("get-user");

        let user;
        try {
            let playerController = this.getPlayerController(address);
            if (playerController) {
                user = await playerController.getUser();
            } else {
                user = await this.loadUser(address);
            }
        } finally {
            await this._lock.release("get-user");
        }

        return user;
    }

    /**
     * @deprecated since 2021-09-27
     */
    async loadInventory(address) {
        const user = await this.getUser(address);
        return user.inventory;
    }

    async loadInventoryById(userId) {
        const user = await this.getUserById(userId);
        return user.inventory;
    }

    getPlayerController(userId) {
        return this._players[userId];
    }

    getPlayerControllerById(userId) {
        return this._playersById[userId.toString()];
    }

    emitPlayerEvent(userId, event, args) {
        userId = userId.toString();
        this.emit(userId, event, args);
    }

    getTotalOnline() {
        return Object.keys(this._playersById).length;
    }

    handleIncomingConnection(socket) {
        let controller = new PlayerController(socket);

        socket.on("authenticate", async() => {
            if (!controller.address) {
                return;
            }

            // if there is previous controller registered - disconnect it and remove
            let connectedController = this._players[controller.address];
            if (connectedController) {
                connectedController.socket.disconnect(DisconnectCodes.OtherClientSignedIn, "other account connected");
            }

            this._paymentProcessor.registerAsPaymentListener(controller.address, controller);
            this._players[controller.address] = controller;
            this._playersById[controller.id] = controller;

            controller.onAuthenticated();

            this.publishToChannel("online", { online: this.getTotalOnline() });
        });

        socket.on("deauthenticate", () => {
            this._deletePlayerController(controller);

            controller.onDisconnect();
        });

        socket.on("close", () => {
            this._deletePlayerController(controller);

            controller.onDisconnect();

            this.publishToChannel("online", { online: this.getTotalOnline() });
        });
    }

    _deletePlayerController(controller) {
        if (controller.address) {
            this._paymentProcessor.unregister(controller.address, controller);
            delete this._players[controller.address];
            delete this._playersById[controller.id];
        }
    }
}

const game = new Game();

export default game;