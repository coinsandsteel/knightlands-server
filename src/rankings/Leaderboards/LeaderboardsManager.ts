import { Db } from "mongodb";
import { Collections } from "../../database/database";
import { LeaderboardsMeta } from "./LeaderboardTypes";
import { Leaderboard } from "./Leaderboard";
import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { RankingOptions } from "../Ranking";

const PAGE_SIZE = 50;

class LeaderboardsManager implements IRankingTypeHandler {
    private _db: Db;
    private _meta: LeaderboardsMeta;
    private _leaderboards: Array<Leaderboard>

    constructor(db: Db) {
        this._db = db;
        this._leaderboards = [];
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        let promises = [];
        for (const leaderboard of this._leaderboards) {
            promises.push(leaderboard.updateRank(userId, options, value));
        }

        await Promise.all(promises);
    }

    async getUserRank(type: number, userId: string) {
        const board = this._leaderboards.find(x => x.type == type);
        if (!board) {
            return null;
        }

        return await board.getUserRank(userId);
    }

    async getRankings(type: number, page: number) {
        const board = this._leaderboards.find(x => x.type == type);
        if (!board) {
            return null;
        }

        return await board.getRankings(page);
    }

    async init() {
        console.log("Initializing leaderboards...");

        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "leaderboards" }) as LeaderboardsMeta;

        const promises = [];
        for (const definition of this._meta.definitions) {
            const leaderboard = new Leaderboard(PAGE_SIZE, definition.isDecimal);
            this._leaderboards.push(leaderboard);
            promises.push(leaderboard.init(this._db, definition.type));
        }

        await Promise.all(promises);
    }
};

export default LeaderboardsManager;
