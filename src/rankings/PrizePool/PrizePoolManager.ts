import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { ObjectId, Collection, Db } from "mongodb";
import { Collections } from "../../database/database";
import { RankingOptions } from "../Ranking";
import { PrizePoolMeta } from "./Types";
import Game from "../../game";
import errors from "../../knightlands-shared/errors";
import blockchains from "../../knightlands-shared/blockchains";
import { Blockchain } from "../../blockchain/Blockchain";

interface WithdrawalData {
    withdrawalId: string;
    from: string;
    amount: string;
    blockNumber: number;
    transactionHash: string;
}

export class PrizePoolManager implements IRankingTypeHandler {
    private _meta: PrizePoolMeta;
    private _collection: Collection;
    private _pageSize: number;

    constructor() {
        this._pageSize = 50;

        // Game.blockchain.on(Blockchain.HalloweenWithdrawal, this.handleWithdawal.bind(this));
    }

    async init() {
        await this._startNewSeason();
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        if (Game.season.isFinished()) {
            return;
        }

        if (!this._collection) {
            return;
        }

        const prizePlace = this.findOptionMeta(options);
        if (!prizePlace) {
            return;
        }

        if (prizePlace.highest) {
            // we only track all-tmie high value
            const data = await this._collection.findOne({ _id: userId }, { projection: { [`b.${options.type}`]: 1 } });
            if (data) {
                // check if score is greater
                if (data.b && data.b[options.type] && data.b[options.type] < value) {
                    // increment only by the difference between current value and new all-time high value
                    value -= data.b[options.type];
                } else {
                    // early exit, nothing to update here
                    return;
                }
            }
        }

        // incremental
        const finalValue = value * prizePlace.weight;
        const total = await this._collection.find({}).count();

        await this._collection.updateOne(
            { _id: userId },
            {
                $inc: {
                    score: finalValue,
                    [`b.${options.type}`]: value // track score contribution
                },
                $setOnInsert: { order: total + 1 }
            },
            { upsert: true }
        );
    }

    getRewards() {
        return this._meta.spots;
    }

    async getUserRank(userId: ObjectId) {
        let userRecord = await this._collection.findOne({ _id: userId });
        let score = userRecord ? userRecord.score : null;
        if (!score) {
            return null;
        }

        let rank = await this._collection.find({ score: { $gt: score } }).count() + 1;
        const claimed = await this.isClaimedReward(userId);
        return {
            rank,
            id: userId.toString(),
            score: score.toString(),
            b: userRecord.b,
            claimed
        };
    }

    async getRankings(page: number) {
        const total = await this._collection.find({}).count();

        const records = await this._collection.aggregate([
            { $sort: { score: -1, order: 1 } },
            { $skip: page * this._pageSize },
            { $limit: this._pageSize },
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
            finished: total <= page * this._pageSize + this._pageSize
        };
    }

    async isClaimedReward(userId: ObjectId) {
        const records = await Game.activityHistory.getRecords(userId, { "data.claimed": true, type: "season_0" });
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
        const rewards = this.getRewards();
        const reward = rewardIndex >= Object.keys(rewards).length ? 0 : rewards[rewardIndex];
        if (reward <= 0) {
            throw errors.IncorrectArguments;
        }

        const records = await Game.activityHistory.getRecords(userId, { "data.claimed": { $exists: false }, type: "season_0" });
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
                    await Game.activityHistory.save(db, userId, "season_0", blockchainId, {
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

    // async handleWithdawal(blockchainId: string, data: WithdrawalData) {
    //     // mark as claimed
    //     await Game.activityHistory.update(Game.db, { _id: new ObjectId(data.withdrawalId) }, { claimed: true, pending: false });
    // }

    private findOptionMeta(options: RankingOptions) {
        for (let i = 0; i < this._meta.stats.length; ++i) {
            let match = true;
            const typeOptions = this._meta.stats[i].type;
            for (const key in typeOptions) {
                if (typeOptions[key] != options[key]) {
                    match = false;
                    break;
                }
            }

            if (match) {
                return this._meta.stats[i];
            }
        }

        return null;
    }

    private async _tryCommitRewards(season: number) {
        const collection = Game.db.collection(`prize_pool_${season}`);
        if (await collection.find().count() == 0) {
            // empty season
            return;
        }
    }

    private async _startNewSeason() {
        const season = Game.season.getSeason();
        const prizePools = await Game.db.collection(Collections.Meta).findOne({ _id: "prize_pool" });
        if (!prizePools.pools[season]) {
            return;
        }

        this._meta = prizePools.pools[season];
        this._collection = Game.db.collection(`prize_pool_${season}`);
        this._collection.createIndex({ score: 1 });
        this._collection.createIndex({ order: 1 });

        if (await this._collection.find().count() == 0) {
            await this._tryCommitRewards(season - 1);
        }
    }
}