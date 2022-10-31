import { Collection, Db, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import Game from "../../game";
import { DungeonMeta } from "./types";
import Events from "../../knightlands-shared/events";
import { DungeonController } from "./DungeonController";
import { Lock } from "../../utils/lock";
import blockchains from "../../knightlands-shared/blockchains";
import { Blockchain } from "../../blockchain/Blockchain";
import errors from "../../knightlands-shared/errors";

const PAGE_SIZE = 50;

interface WithdrawalData {
    withdrawalId: string;
    from: string;
    amount: string;
    blockNumber: number;
    transactionHash: string;
}

export class DungeonManager {
    private _meta: DungeonMeta;
    private _collection: Collection;
    private _saveCollection: Collection;

    constructor() {
        this._saveCollection = Game.db.collection(Collections.HalloweenUsers);

        Game.blockchain.on(Blockchain.HalloweenWithdrawal, this.handleWithdawal.bind(this));
    }

    async init(iapExecutor) {
        this._collection = Game.db.collection(Collections.HalloweenRanks);
        this._collection.createIndex({ score: 1 });
        this._collection.createIndex({ order: 1 });

        this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "simple_dungeon_meta" });

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

    isFinished() {
        return (this._meta.startTime + 18 * 86400) < Game.nowSec;
    }

    getMeta() {
        return this._meta;
    }

    getEnemyData(enemyId: number) {
        return this.getMeta().enemies.enemiesById[enemyId];
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

        let rank = await this._collection.find({ $or:[{ score: { $gt: score } }, { score, order: { $lt: userRecord.order } }] }).count() + 1;
        return {
            rank,
            id: userId.toString(),
            score: score.toString(),
            b: userRecord.b,
            claimed: false
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
            const dungeon = new DungeonController(await Game.getUserById(userId));
            await dungeon.init();
            await dungeon.enter(true, false);
        } else {
            await controller.enterHalloween();
        }

    }

    async isClaimedReward(userId: ObjectId) {
        const records = await Game.activityHistory.getRecords(userId, { "data.claimed": true, type: "halloween" });
        return records && records.length > 0;
    }

    async createOrGetWithdrawRequest(userId: ObjectId, to: string) {
        const userRecord = await this.getUserRank(userId)
        if (!userRecord) {
            throw errors.IncorrectArguments;
        }

        if (await this.isClaimedReward(userId)) {
            throw errors.IncorrectArguments;
        }

        const rewardIndex = userRecord.rank - 1;
        const rewards = this.getMeta().rewards;
        const reward = rewardIndex >= rewards.length ? 0 : rewards[rewardIndex];
        if (reward <= 0) {
            throw errors.IncorrectArguments;
        }

        const records = await Game.activityHistory.getRecords(userId, { "data.claimed": { $exists: false }, type: "halloween" });
        let receipt;
        if (records && records.length > 0) {
            const record = records[0]
            receipt = {
                withdrawalId: record._id.toHexString(),
                signature: record.data.signature,
                amount: record.data.amount
            };
        }
        if (!receipt) {
            receipt = await Game.dbClient.withTransaction(async (db: Db) => {
                const blockchainId = blockchains.Polygon;
                const chain = Game.blockchain.getBlockchain(blockchainId);
                const bigAmount = chain.getBigIntNativeAmount(reward, 6); //USDC token has 6 decimals
                let withdrawalId = (
                    await Game.activityHistory.save(db, userId, "halloween", blockchainId, {
                        user: userId,
                        chain: blockchainId,
                        currency: "usdc",
                        date: Game.nowSec,
                        pending: true,
                        amount: bigAmount.toString(),
                        to
                    })
                ).insertedId.toHexString();

                let signature = await chain.sign(chain.getPotAddress(), to, withdrawalId, bigAmount);

                await Game.activityHistory.update(db, { _id: new ObjectId(withdrawalId) }, { signature });

                return {
                    withdrawalId,
                    signature,
                    amount: bigAmount.toString()
                };
            });
        }

        return receipt;
    }

    async handleWithdawal(blockchainId: string, data: WithdrawalData) {
        // mark as claimed
        await Game.activityHistory.update(Game.db, { _id: new ObjectId(data.withdrawalId) }, { claimed: true, pending: false });
    }
}