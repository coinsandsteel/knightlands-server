import { Collection, ObjectId } from "mongodb";
import { Collections } from "../database/database";
import Game from "../game";
import Events from "../knightlands-shared/events";
import { XmasController } from "./XmasController";
import { Lock } from "../utils/lock";

const PAGE_SIZE = 50;

export class XmasManager {
    private _meta: any;
    private _collection: Collection;
    private _saveCollection: Collection;
    private _lock: Lock;
    
    constructor() {
        this._lock = new Lock();
        this._saveCollection = Game.db.collection(Collections.XmasUsers);
    }

    async init(iapExecutor) {
        this._collection = Game.db.collection(Collections.XmasRanks);
        this._collection.createIndex({ score: 1 });
        this._collection.createIndex({ order: 1 });

        // TODO create meta
        this._meta = {};

        iapExecutor.registerAction(this._meta.iap, async context => {
            return this._allowEntrance(context.iap, context.userId);
        });

        iapExecutor.mapIAPtoEvent(this._meta.iap, Events.PurchaseComplete);
    }

    async loadProgress(userId: ObjectId) {
        return this._saveCollection.findOne({ _id: userId })
    }

    async saveProgress(userId: ObjectId, saveData: any) {
        return this._saveCollection.updateOne({ _id: userId }, { $set: saveData }, { upsert: true });
    }

    getMeta() {
        return this._meta;
    }

    async updateRank(userId: ObjectId, points: number) {
        await this._collection.updateOne(
            { _id: userId },
            {
                $inc: {
                    score: points
                },
                $set: {
                    order: Game.now
                }
            },
            { upsert: true }
        );
    }

    async getUserRank(userId: ObjectId) {
        let userRecord = await this._collection.findOne({ _id: userId });
        let score = userRecord ? userRecord.score : null;
        if (!score) {
            return null;
        }

        let rank = await this._collection.find({ score: { $gt: score } }).count() + 1;
        return {
            rank,
            id: userId.toString(),
            score: score.toString(),
            b: userRecord.b
        };
    }

    async totalPlayers() {
        return this._collection.find({}).count();
    }

    async getRankings(page: number) {
        const total = await this.totalPlayers();

        const records = await this._collection.aggregate([
            { $sort: { score: -1, order: 1 } },
            { $skip: page * PAGE_SIZE },
            { $limit: PAGE_SIZE },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            {
                $project: {
                    id: "$_id",
                    name: {
                        $ifNull: [{ $arrayElemAt: ["$user.character.name.v", 0] }, ""]
                    },
                    avatar: {
                        $ifNull: [{ $arrayElemAt: ["$user.character.avatar", 0] }, -1]
                    },
                    score: { $convert: { input: "$score", to: "string" } }
                }
            },
            {
                $project: { _id: 0 }
            }
        ]).toArray();

        return {
            records,
            finished: total <= page * PAGE_SIZE + PAGE_SIZE
        };
    }

    async _allowEntrance(iap: string, userId: ObjectId) {
        let controller = await Game.getPlayerControllerById(userId);
        if (!controller) {
            const xmas = new XmasController(await Game.getUserById(userId));
            await xmas.init();
            await xmas.enter();
        } else {
            await controller.enterXmas();
        }
        
    }
}