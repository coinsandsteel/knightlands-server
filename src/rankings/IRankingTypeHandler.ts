import { RankingOptions } from "./Ranking";

export interface IRankingTypeHandler {
    updateRank(userId: string, options: RankingOptions, value: number): void;
};