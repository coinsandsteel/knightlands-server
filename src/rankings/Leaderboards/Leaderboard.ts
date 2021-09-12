import { Db, Collection } from "mongodb";
import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { RankingOptions } from "../Ranking";
import { Collections } from "../../database/database";
import RankingType from "../../knightlands-shared/ranking_type";
import { Long } from "mongodb";

export class Leaderboard implements IRankingTypeHandler {
    private _collection: Collection;
    private _typeOptions: RankingOptions;
    private _pageSize: number;
    private _isDecimal: boolean;

    type: number;

    constructor(pageSize: number, isDecimal: boolean) {
        this._pageSize = pageSize;
        this._isDecimal = isDecimal;
    }

    async init(db: Db, options: RankingOptions) {
        let key = `${options.type}`;

        this.type = options.type;
        this._typeOptions = options;

        this._collection = db.collection(`${Collections.Leaderboards}_${key}`);
        await this._collection.createIndex({ score: -1 });
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        if (value == 0) {
            return;
        }

        if (
            this._typeOptions.type != options.type ||
            this._typeOptions.raid != options.raid ||
            this._typeOptions.rarity != options.rarity
        ) {
            return;
        }

        let finalValue: number | Long = value;

        if (!this._isDecimal) {
            finalValue = new Long(value.toString(), true);
        }

        await this._collection.updateOne(
            { _id: userId },
            {
                $inc: { score: finalValue },
                $setOnInsert: { id: userId }
            },
            { upsert: true }
        );
    }

    async getRankings(page: number) {
        const total = await this._collection.find({}).count();

        const records = await this._collection.aggregate([
            { $sort: { score: -1 } },
            { $skip: page * this._pageSize },
            { $limit: this._pageSize },
            { $lookup: { from: "users", localField: "id", foreignField: "_id", as: "user" } },
            {
                $project: {
                    id: 1,
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

    async getUserRank(userId: string) {
        let userRecord = await this._collection.findOne({ _id: userId });
        let score = userRecord ? userRecord.score : null;
        if (!score) {
            return null;
        }

        if (this._isDecimal && score.toUnsigned) {
            score = score.toUnsigned();
        }


        let rank = await this._collection.find({ score: { $gt: score } }).count() + 1;
        return {
            id: this.type,
            rank: {
                rank,
                id: userId,
                score: score.toString()
            }
        };
    }
};
