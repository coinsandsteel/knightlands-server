import { Db } from "mongodb";
import { Collections } from "../database";
import TournamentManager from "./Tournaments/TournamentsManager";
import LeaderboardsManager from "./LeaderboardsManager";
import RacesManager from "./Races/RacesManager";
import { RankingOptions } from "./Ranking";
import { IRankingTypeHandler } from "./IRankingTypeHandler";

class Rankings implements IRankingTypeHandler {
    private _db: Db;

    tournaments: TournamentManager;
    leaderboards: LeaderboardsManager;
    races: RacesManager;

    constructor(db: Db) {
        this._db = db;
    }

    async init() {
        await this._db.collection(Collections.TournamentTables).createIndex({ tableId: 1, "records.id": 1 }, { unique: true });
        await this._db.collection(Collections.TournamentTables).createIndex({ tableId: 1, "records.score": 1 });

        await this._db.collection(Collections.RaceTables).createIndex({ tableId: 1, "records.id": 1 }, { unique: true });
        await this._db.collection(Collections.RaceTables).createIndex({ tableId: 1, "records.score": 1 });

        this.tournaments = new TournamentManager(this._db);
        this.leaderboards = new LeaderboardsManager(this._db);
        this.races = new RacesManager(this._db);

        await this.tournaments.init();
        await this.leaderboards.init();
        await this.races.init();
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        await this.tournaments.updateRank(userId, options, value);
        await this.races.updateRank(userId, options, value);
    }
};

export default Rankings;