import { Db } from "mongodb";
import { Collections } from "../database";
import TournamentManager from "./TournamentsManager";
import LeaderboardsManager from "./LeaderboardsManager";

class Rankings {
    _db: Db;

    tournaments: TournamentManager;
    leaderboards: LeaderboardsManager;

    constructor(db: Db) {
        this._db = db;
    }

    async init() {
        await this._db.collection(Collections.TournamentTables).createIndex({ "records.id": 1 }, { unique: true });
        await this._db.collection(Collections.TournamentTables).createIndex({ tableId: 1, "records.score": 1 });


        this.tournaments = new TournamentManager(this._db);
        this.leaderboards = new LeaderboardsManager(this._db);

        await this.tournaments.init();
        await this.leaderboards.init();
    }
};

export default Rankings;