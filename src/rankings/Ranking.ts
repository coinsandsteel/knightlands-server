import { Collection, ObjectId } from "mongodb";
import { Lock } from "../utils/lock";
import { IRankingTypeHandler } from "./IRankingTypeHandler";

export interface RankingState {
    typeOptions: RankingOptions;
}

export interface RankingOptions {
    type: number;
    itemType?: string;
    raid?: string;
    rarity?: string;
}

export interface RankingRecord {
    id: string;
    score: number;
    rank?: number;
}

export interface RankingTable {
    records: Array<RankingRecord>;
}

export class Ranking implements IRankingTypeHandler {
    private _typeOptions: RankingOptions;
    private _pageSize: number;
    private _collection: Collection;
    private _lock: Lock;
    private _id: string;
    private _participantScores: { [key: string]: number };

    constructor(collection: Collection, tableId: string, state: RankingState) {
        this._lock = new Lock();

        this._id = tableId;
        this._typeOptions = state.typeOptions;
        this._pageSize = 20;
        this._collection = collection;
        this._participantScores = {};
    }

    async init() {
        let records = await this._getRanking(0, Number.MAX_SAFE_INTEGER);
        for (const record of records) {
            this._participantScores[record.id] = record.score;
        }
    }

    async updateRank(id: string, options: RankingOptions, value: number) {
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

        await this._lock.acquire(this._id);
        try {
            await this._collection.updateOne(
                { tableId: this._id, "records.id": id },
                {
                    $inc: { "records.$.score": value }
                }
            );
            this._participantScores[id] += value;
        } finally {
            this._lock.release(this._id);
        }
    }

    async removeRank(id: string) {
        await this._collection.updateOne(
            { tableId: this._id },
            {
                $pull: { records: { id } }
            }
        );

        delete this._participantScores[id];
    }

    async addRank(id: string) {
        await this._collection.updateOne(
            { tableId: this._id },
            {
                $push: {
                    records: {
                        $each: [{ score: 0, id }],
                        $sort: { score: 1 }
                    }
                }
            },
            { upsert: true });

        this._participantScores[id] = 0;
    }

    hasParticipant(id: string) {
        const score = this._participantScores[id];
        return score !== undefined && score !== null;
    }

    totalParticipants() {
        return Object.keys(this._participantScores).length;
    }

    async getRankings(page: number) {
        const records = await this._getRanking(page, this._pageSize);
        return {
            records,
            finished: records.length <= this._pageSize
        };
    }

    getParticipantScore(id: string) {
        return this._participantScores[id];
    }

    async getParticipant(id: string) {
        return;
    }

    async getParticipantRank(id: string) {
        const participant = await this._collection.findOne({ tableId: this._id }, { projection: { records: { $elemMatch: { id } } } });
        const match = await this._collection.aggregate([
            { $match: { tableId: this._id } },
            { $unwind: "$records" },
            { $match: { "records.score": { $gte: this.getParticipantScore(id) } } },
            { $count: "total" }
        ]).toArray();

        if (match.length == 0) {
            return null;
        }

        return { ...participant.records[0], rank: match[0].total };
    }

    async getParticipants(count: number) {
        const pipeline: any[] = [
            { $match: { tableId: this._id } },
            { $unwind: "$records" },
            { $sort: { "score": -1 } },
            { $limit: count },
            {
                $project: {
                    score: "$records.score",
                    id: "$records.id"
                }
            },
            {
                $project: { _id: 0 }
            },
            { $sort: { "score": -1 } }
        ];

        return this._collection.aggregate(pipeline).toArray();
    }

    private async _getRanking(page: number, limit: number) {
        const pipeline: any[] = [
            { $match: { tableId: this._id } },
            { $unwind: "$records" },
            { $sort: { "score": -1 } },
            { $skip: page * this._pageSize },
            { $limit: limit },
            { $lookup: { from: "users", localField: "records.id", foreignField: "_id", as: "user" } },
            {
                $project: {
                    score: "$records.score",
                    id: "$records.id",
                    name: {
                        $ifNull: [{ $arrayElemAt: ["$user.character.nickname", 0] }, ""]
                    }
                }
            },
            {
                $project: { _id: 0 }
            },
            { $sort: { "score": -1 } }
        ];

        return this._collection.aggregate(pipeline).toArray();
    }
}
