import { Db } from "mongodb";

export interface RankingOptions {
    orderBy: Array<string>;
    pageSize: number;
}

export class Ranking {
    static readonly RankChanged = "_evt_rank_changed";

    _orderBy: Array<string>;
    _pageSize: number;
    _db: Db;

    constructor(db: Db, options: RankingOptions) {
        this._orderBy = options.orderBy;
        this._pageSize = options.pageSize;
        this._db = db;
    }

    async updateRankForEntry(id, values: Array<any>) {
        await this._db.updateOne({ id });
    }

    getRankings(page: number) {
        
    }
}