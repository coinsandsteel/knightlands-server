import { Collection, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import Game from "../../game";
import Events from "../../knightlands-shared/events";
import { CPointsManager } from "./CPointsManager";

const PAGE_SIZE = 50;

const IAPS = [
  { iap: "sb_1", count: 9999 },
  { iap: "sb_2", count: 9999 },
  { iap: "sb_3", count: 9999 },
  { iap: "sb_4", count: 9999 },
  { iap: "sb_5", count: 9999 },
  { iap: "sb_6", count: 9999 }
];

export class XmasManager {
    private _meta: any;
    private _collection: Collection;
    private _saveCollection: Collection;

    public cpoints: CPointsManager;
    
    constructor() {
        this.cpoints = new CPointsManager();
        this._saveCollection = Game.db.collection(Collections.XmasUsers);
    }

    async init() {
        await this.cpoints.init();
        this._collection = Game.db.collection(Collections.XmasRanks);
        this._collection.createIndex({ score: 1 });
        this._collection.createIndex({ order: 1 });

        // IAPS.forEach(record => {
        //     iapExecutor.registerAction(record.iap, async context => {
        //         return this._topUpSantabucks(context.userId, record.count);
        //     });

        //     iapExecutor.mapIAPtoEvent(record.iap, Events.PurchaseComplete);
        // });
    }

    async loadProgress(userId: ObjectId) {
        return this._saveCollection.findOne({ _id: userId }, { projection: { "state.cpoints": 1 } })
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

    async _topUpSantabucks(userId: ObjectId, count: number) {
        const controller = await Game.getPlayerControllerById(userId);
        if (controller) {
            controller.xmas.addSantabucks(count);
        } else {

        }
    }
}