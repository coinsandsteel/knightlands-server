import { RankingOptions, RankingState } from "./../Ranking";
import { ObjectID } from "mongodb";

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
    tier: number;
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
    _id: ObjectID;
    state: TournamentState;
    tier: number|string;
    startTime: number;
    duration: number;
    rewards: TournamentRewardsMeta;
    rankingState: RankingState;
    looted: { [key: string]: boolean };
}

export interface TournamentsState {
    runningTournaments: Array<ObjectID>;
}