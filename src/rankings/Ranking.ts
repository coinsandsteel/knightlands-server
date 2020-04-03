import { Collection } from "mongodb";
import { Lock } from "../utils/lock";
import { IRankingTypeHandler } from "./IRankingTypeHandler";
import bounds from "binary-search-bounds";

export enum RankingType {
    EnergySpent,
    StaminaSpent,
    DamageInRaids,
    ExpGained,
    GoldLooted,
    DktEarned,
    GoldSpent,
    DamageInParticularRaid,
    CollectedItemsByRarity,
    CraftedItemsByRarity,
    DisenchantedItemsByRarity
}

export interface RankingState {
    typeOptions: RankingOptions;
}

export interface RankingOptions {
    type: RankingType;
    raid?: number;
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
    // static readonly RankChanged = "_evt_rank_changed";

    _typeOptions: RankingOptions;
    _pageSize: number;
    _collection: Collection;
    _rankingTable: RankingTable;
    _lock: Lock;
    _id: string;
    _participantsCache: { [key: string]: boolean };

    constructor(collection: Collection, tableId: string, state: RankingState) {
        this._lock = new Lock();

        this._id = tableId;
        this._typeOptions = state.typeOptions;
        this._pageSize = 20;
        this._collection = collection;
    }

    async init() {
        let table = await this._getRankingTable();
        for (const record of table.records) {
            this._participantsCache[record.id] = true;
        }
    }

    async updateRank(id: string, options: RankingOptions, value: number) {
        if (
            this._typeOptions.type != options.type ||
            this._typeOptions.raid != options.raid ||
            this._typeOptions.rarity != options.rarity
        ) {
            return;
        }

        await this._collection.updateOne(
            { tableId: this._id, "records.id": id },
            {
                $inc: { "records.$.score": value }
            }
        );
    }

    async removeRank(id: string) {
        await this._collection.updateOne(
            { tableId: this._id },
            {
                $pull: {
                    records: { id }
                }
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
                        $each: [{ score: 0 }],
                        $sort: { score: 1 }
                    }
                }
            },
            { upsert: true });

        this._rankingTable = null;
        this._participantsCache[id] = true;
    }

    async hasParticipant(id: string) {
        return this._participantsCache[id];
    }

    async getRankings(page: number) {
        let table = await this._getRankingTable();
        return table.records.slice(page * this._pageSize, page * this._pageSize + this._pageSize);
    }

    async getParticipant(id: string) {
        return await this._collection.findOne({ tableId: this._id, "records.id": id });
    }

    async getParticipantRank(id: string) {
        let participants = await this.getParticipants();
        let rank = bounds.eq(
            participants,
            { id, score: 0 },
            (x, y) => {
                return x.id.localeCompare(y.id, 'en', { sensitivity: 'base' });
            }
        );

        if (rank != -1) {
            return { ...participants[rank], rank };
        }

        return null;
    }

    async getParticipants() {
        let table = await this._getRankingTable();
        return table.records;
    }

    private async _getRankingTable() {
        if (!this._rankingTable) {
            await this._lock.acquire(this._id);
            await this._reloadRankingTable();
        }
        return this._rankingTable;
    }

    private async _reloadRankingTable() {
        try {
            if (!this._rankingTable) {
                this._rankingTable = {
                    records: (await this._collection.find({ tableId: this._id }).toArray())
                };
            }
        } finally {
            this._lock.release(this._id);
        }
    }
}