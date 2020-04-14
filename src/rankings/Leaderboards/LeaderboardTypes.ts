import { RankingOptions } from "../Ranking";

export interface LeaderboardDefinition {
    type: RankingOptions;
};

export interface LeaderboardsMeta {
    definitions: Array<LeaderboardDefinition>;
}