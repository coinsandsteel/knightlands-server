import { RankingOptions, RankingState } from "./../Ranking";
import { ObjectID } from "mongodb";

export interface TournamentConfiguration {
    duration: number;
    types: Array<RankingOptions>;
}

export interface TournamentRewardSchema {
    dkt: number;
    minRank: number;
    maxRank: number;
    loot: any;
}

export interface TournamentRewardsMeta {
    id: number;
    tier: number;
    dktPoolSize: number;
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
    divTokenRewards: TournamentDivTokenRewards;
    looted: { [key: string]: boolean };
}

export interface TournamentsState {
    runningTournaments: Array<ObjectID>;
}

export interface TournamentDivTokenRewards {
    tokenPool: number;
}
