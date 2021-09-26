import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { ObjectId, Collection } from "mongodb";
import { Collections } from "../../database/database";
import { RankingOptions } from "../Ranking";
import { PrizePoolMeta } from "./Types";
import Game from "../../game";

export class PrizePoolManager implements IRankingTypeHandler {
    private _meta: PrizePoolMeta;
    private _collection: Collection;
    private _pageSize: number;

    constructor() {
        this._pageSize = 50;
    }

    async init() {
        await this._startNewSeason();
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
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
        return {
            rank,
            id: userId.toString(),
            score: score.toString(),
            b: userRecord.b
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