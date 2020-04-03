import { RankingOptions, RankingState } from "./Ranking";

export interface TournamentConfiguration {
    duration: number;
    types: Array<RankingOptions>;
}

export interface TournamentRewardSchema {
    minRank: number;
    maxRank: number;
    loot: any;
}

export interface TournamentRewardsMeta {
    tier: string|number;
    rewards: Array<TournamentRewardSchema>;
}

export interface TournamentsMeta {
    templates: { [key: string]: TournamentConfiguration };
    rewards: { [key: string]: Array<TournamentRewardsMeta> };
}

export enum TournamentState {
    Running,
    Finished
}

export interface TournamentRecord {
    _id: string;
    state: TournamentState;
    tier: string|number;
    startTime: number;
    duration: number;
    rewards: Array<TournamentRewardSchema>;
    rankingState: RankingState;
    looted: { [key: string]: boolean };
}

export interface Tournaments {
    runningTournaments: Array<string>;
}