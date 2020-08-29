import { Collection } from "mongodb";
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
    private _rankingTable: RankingTable;
    private _lock: Lock;
    private _id: string;
    private _participantsCache: { [key: string]: boolean };

    constructor(collection: Collection, tableId: string, state: RankingState) {
        this._lock = new Lock();

        this._id = tableId;
        this._typeOptions = state.typeOptions;
        this._pageSize = 20;
        this._collection = collection;
        this._participantsCache = {};
    }

    async init() {
        let table = await this._getRankingTable();
        for (const record of table.records) {
            this._participantsCache[record.id] = true;
        }
    }

    async updateRank(id: string, options: RankingOptions, value: number) {
        console.log("update rank", ...arguments);

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

        console.log("update rank records for", this._id);

        await this._lock.acquire(this._id);
        try {
            await this._collection.updateOne(
                { tableId: this._id, "records.id": id },
                {
                    $inc: { "records.$.score": value }
                }
            );

            this._rankingTable = null;
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

        this._rankingTable = null;
        delete this._participantsCache[id];
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

        this._rankingTable = null;
        this._participantsCache[id] = true;
    }

    hasParticipant(id: string) {
        return this._participantsCache[id];
    }

    totalParticipants() {
        return Object.keys(this._participantsCache).length;
    }

    async getRankings(page: number) {
        const table = await this._getRankingTable();
        const rangeEnd = page * this._pageSize + this._pageSize;
        return {
            records: table.records.slice(page * this._pageSize, rangeEnd),
            finished: table.records.length <= rangeEnd
        };
    }

    async getParticipant(id: string) {
        return await this._collection.findOne({ tableId: this._id, "records.id": id });
    }

    async getParticipantRank(id: string) {
        let participants = await this._getSearchTable();
        let rank = participants.findIndex(x => x.id == id);
        if (rank != -1) {
            return { ...participants[rank], rank: rank + 1 };
        }

        return null;
    }

    async getParticipants() {
        let table = await this._getRankingTable();
        return table.records;
    }

    async _getSearchTable() {
        await this._getRankingTable();
        return this._rankingTable.records;
    }

    private async _getRankingTable() {
        if (!this._rankingTable) {
            await this._lock.acquire(this._id);

            try {
                if (!this._rankingTable) {
                    const table = await this._collection.findOne({ "tableId": this._id });
                    this._rankingTable = table || { records: [] };
                    this._rankingTable.records.sort((x, y) => {
                        return y.score - x.score;
                    });
                }
            } finally {
                this._lock.release(this._id);
            }
        }
        return this._rankingTable;
    }
}
