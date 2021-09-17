import { RankingOptions } from "../Ranking";

export interface PrizePlace {
    type: RankingOptions;
    weight: number;
    highest: boolean;
}

export interface PrizePoolMeta {
    season: number;
    stats: PrizePlace[];
    spots: { [key: number]: number };
}