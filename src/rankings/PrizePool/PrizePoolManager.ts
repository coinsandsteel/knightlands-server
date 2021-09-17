import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { Db, ObjectId, Collection } from "mongodb";
import { Collections } from "../../database/database";
import { RankingOptions } from "../Ranking";
import { PrizePoolMeta } from "./Types";
import Game from "../../game";

export class PrizePoolManager implements IRankingTypeHandler {
    private _meta: PrizePoolMeta;
    private _collection: Collection;

    async init() {
        await this._startNewSeason();
    }

    updateRank(userId: string, options: RankingOptions, value: number): void {
        if (!this.isMatch(options)) {
            return;
        }
    }

    private isMatch(options: RankingOptions) {
        for (let i = 0; i < this._meta.stats.length; ++i) {
            const typeOptions = this._meta.stats[i].type;
            if (
                typeOptions.type != options.type ||
                typeOptions.raid != options.raid ||
                typeOptions.rarity != options.rarity
            ) {
                return true;
            }
        }

        return false;
    }

    private async _startNewSeason() {
        const season = Game.season.getSeason();
        const prizePools = await Game.db.collection(Collections.Meta).findOne({ _id: "prize_pool" });
        if (!prizePools.pools[season]) {
            return;
        }

        this._meta = prizePools.pools[season];
        this._collection = Game.db.collection(`prize_pool_${season}`);
    }
}