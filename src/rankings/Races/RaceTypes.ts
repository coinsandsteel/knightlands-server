import { RankingOptions } from "./../Ranking";
import { ObjectId } from "mongodb";
import { RaceShop } from "./RaceShop";

export enum RaceState {
    Running,
    Finished
}

export interface RaceConfiguration {
    tier: number | string;
    duration: number;
    durationStd: number;
    type: RankingOptions;
    rewards: Array<number>;
    baseTarget: number;
}

interface RaceTargetScalingMeta {
    targetIncreaseStep: number;
    targetDecreaseStep: number;
    targetIncreaseFalloff: number;
    rewardsPowerScale: number;
    minMultiplier: number;
    maxMultiplier: number;
}

interface RaceReward {
    item: number;
    quantity: number;
    price: number;
}

export interface RaceShopConfiguration {
    currencyItem: number;
    items: { [key: number]: RaceReward };
}

export interface RacesMeta {
    templates: { [key: string]: Array<RaceConfiguration> };
    targetScaling: RaceTargetScalingMeta;
    winnerCooldown: number;
    shop: RaceShopConfiguration;
}

export interface RaceRecord {
    _id: ObjectId;
    state: RaceState;
    startTime: number;
    finalDuration: number;
    targetMultiplier: number;
    rewardsMultiplier: number;
    looted: { [key: string]: boolean };
    config: RaceConfiguration;
}

export interface RacesState {
    tiersRunning: { [key: number]: boolean };
    runningRaces: Array<ObjectId>;
    targetMultipliers: { [key: string]: number }; // {RankingType_subType}: multiplier
    rewardsMultiplier: { [key: string]: number }; // {RankingType_subType}: multiplier
}
