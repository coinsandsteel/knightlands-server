import { Db } from "mongodb";
import { Collections } from "../../database";

class LeaderboardsManager {
    _db:Db;

    constructor(db: Db) {
        this._db = db;
    }

    async init() {
        let leaderboardsConfiguration = await this._db.collection(Collections.Meta).findOne({ _id: "leaderboards" });

        // first start all-time permanent leaderboards without rewards, just for the info

        // now setup weekly leaderboards with rewards at the end
        
    }
};

export default LeaderboardsManager;