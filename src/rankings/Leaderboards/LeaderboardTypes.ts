import { RankingOptions } from "../Ranking";

export interface LeaderboardDefinition {
    type: RankingOptions;
    isDecimal: boolean;
};

export interface LeaderboardsMeta {
    definitions: Array<LeaderboardDefinition>;
}