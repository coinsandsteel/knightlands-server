import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { Db, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import { RankingOptions } from "../Ranking";

export class PrizePoolManager implements IRankingTypeHandler {
    private _db: Db;
    private _

    updateRank(userId: string, options: RankingOptions, value: number): void {

    }
}