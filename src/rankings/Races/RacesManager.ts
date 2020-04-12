import { Db, ObjectId } from "mongodb";
import { Collections } from "../../database";
import { RacesState, RacesMeta, RaceConfiguration, RaceState, RaceRecord } from "./RaceTypes";
import { Race } from "./Race";
import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { RankingOptions, RankingRecord } from "../Ranking";
import Errors from "../../knightlands-shared/errors";
import random from "../../random";
import Game from "../../game";
import RankingType from "../../knightlands-shared/ranking_type";
import { Lock } from "../../utils/lock";

class RacesManager implements IRankingTypeHandler {
    private _db: Db;
    private _meta: RacesMeta;
    private _state: RacesState;
    private _races: Race[];
    private _lock: Lock;

    constructor(db: Db) {
        this._db = db;
        this._races = [];
        this._lock = new Lock();
    }

    async init() {
        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "races" });
        this._state = await this._db.collection(Collections.Races).findOne({ _id: "state" });

        if (this._state) {
            await this._loadRaces();
        }

        await this._launchNewRaces();
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        const race = this._findRaceWithUser(userId);
        if (race) {
            let id = race.id.valueOf();
            await this._lock.acquire(id);
            await race.updateRank(userId, options, value);
            this._lock.release(id);
        }
    }

    async join(userId: string, raceId: string) {
        let tournament = this._findRaceWithUser(userId);
        if (tournament) {
            await tournament.remove(userId);
        }

        tournament = await this._getRace(raceId);
        await tournament.add(userId);
    }

    async claimRewards(userId: string, raceId: string) {
        let raceState = <RaceRecord>await this._db.collection(Collections.Races).findOne({
            _id: ObjectId(raceId),
            state: RaceState.Finished,
            [`looted.${userId}`]: false
        });

        if (!raceState) {
            throw Errors.NoSuchRace;
        }

        let raceInstance = new Race(this._db);
        await raceInstance.loadFromState(raceState);

        if (!raceInstance.hasUser(userId)) {
            throw Errors.NotInTournament;
        }

        let userRank = <RankingRecord>await raceInstance.getUserRank(userId);
        if (!userRank) {
            throw Errors.NotInTournament;
        }

        const rewards = raceInstance.rewards;
        if (rewards.length < userRank.rank) {
            throw Errors.NoRewards;
        }

        let loot = [];
        loot.push({
            item: this._meta.shop.currencyItem,
            quantity: rewards[userRank.rank - 1]
        });

        await this._db.collection(Collections.Races)
            .updateOne(
                { _id: ObjectId(raceId) },
                {
                    $set: { [`looted.${userId}`]: true }
                }
            );

        return loot;
    }

    async getShop() {
        return this._meta.shop;
    }

    async getRewards(raceId: string) {
        let raceState = <RaceRecord>await this._db.collection(Collections.Races).findOne({
            _id: ObjectId(raceId)
        }, { $project: { "config.rewards": 1 } });

        if (!raceState) {
            throw Errors.NoSuchTournament;
        }

        let rewards = raceState.config.rewards.map((x, index)=> {
            return {
                minRank: index+1,
                maxRank: index+1,
                loot: [{
                    itemId: this._meta.shop.currencyItem,
                    minCount: this._getReward(x, raceState.config)
                }]
            };
        });

        return rewards;
    }

    async getFinishedRaces(userId: string) {
        let races = await this._db.collection(Collections.Races).aggregate([
            {
                $match: {
                    state: RaceState.Finished,
                    [`looted.${userId}`]: false
                }
            },
            {
                $project: {
                    looted: 0,
                    state: 0,
                    startTime: 0
                }
            }
        ]).toArray();

        for (const raceState of races) {
            let raceInstance = new Race(this._db);
            await raceInstance.loadFromState(raceState);

            let userRank = <RankingRecord>await raceInstance.getUserRank(userId);
            if (!userRank) {
                throw Errors.NotInRace;
            }

            raceState.rank = userRank;

            let rewards = raceState.config.rewards.map(x=> {
                return {
                    item: this._meta.shop.currencyItem,
                    quantity: this._getReward(x, raceState.config)
                };
            });

            raceState.config.rewards = rewards;
        }

        return races;
    }

    async getRankings(raceId: string, page: number) {
        const race = await this._getRace(raceId);
        return await race.getRankings(page);
    }

    async getRank(raceId: string, userId: string) {
        let race = await this._getRace(raceId);
        if (race) {
            return {
                id: race.id,
                rank: (await race.getUserRank(userId)),
                tier: race.tier,
                target: race.target,
                type: race.type,
                rewardsMultiplier: this._getRewardsMultiplier(race.tier, race.type),
                targetMultiplier: this._getTargetMultiplier(race.tier, race.type),
                predictedMultipliers: this._predictMultipliers(race)
            };
        }

        return null;
    }

    async getRacesInfo(userId: string) {
        let list = [];
        for (const t of this._races) {
            list.push({
                ...t.clientInfo(),
                rewardsMultiplier: this._getRewardsMultiplier(t.tier, t.type),
                targetMultiplier: this._getTargetMultiplier(t.tier, t.type),
                predictedMultipliers: this._predictMultipliers(t)
            });
        }

        let currentRace = this._findRaceWithUser(userId);

        let info = {
            list,
            currentRace: (await this.getRank(currentRace.id, userId))
        };

        return info;
    }

    private _getReward(reward, config: RaceConfiguration) {
        return Math.ceil(reward * this._getRewardsMultiplier(config.tier, config.type));
    }

    private async _loadRaces() {
        console.log("RacesManager schedule races finish...");

        let races = [];
        for (const raceId of this._state.runningRaces) {
            let race = new Race(this._db);

            races.push(race.load(raceId));
            this._addRace(race);
        }

        await Promise.all(races);
    }

    private async _launchNewRaces() {
        console.log("RacesManager launch new races...");

        if (!this._state) {
            this._state = {
                runningRaces: [],
                targetMultipliers: {},
                rewardsMultiplier: {}
            };
        }

        let races = [];
        let promises = [];
        
        for (let [tier, templates] of Object.entries(this._meta.templates)) {
            // if race exist - skip 
            if (this._races.find(x => x.tier == tier)) {
                continue;
            }

            const template = random.pick(templates);
            let race = new Race(this._db);
            promises.push(
                race.create(
                    template,
                    this._getTargetMultiplier(tier, template.type),
                    this._getRewardsMultiplier(tier, template.type)
                )
            );
            races.push(race);
        }

        for (const race of races) {
            this._addRace(race);
        }

        const raceIds = await Promise.all(promises);
        for (const raceId of raceIds) {
            this._state.runningRaces.push(raceId);
        }

        await this._save();
    }

    private _getTargetMultiplier(tier: number|string, rankingOptions: RankingOptions): number {
        const key = this._multiplierKey(tier, rankingOptions);
        return this._state.targetMultipliers[key] || 1;
    }

    private _getRewardsMultiplier(tier: number|string, rankingOptions: RankingOptions): number {
        const key = this._multiplierKey(tier, rankingOptions);
        return this._state.rewardsMultiplier[key] || 1;
    }

    private _handleRaceMultipliers(raceDuration: number, targetsHit: number, raceConfig: RaceConfiguration) {
        this._calculateMultiplier(
            raceDuration, 
            targetsHit, 
            raceConfig, 
            this._state.targetMultipliers, 
            this._state.rewardsMultiplier
        );
    }

    private _calculateMultiplier(
        raceDuration: number, 
        targetsHit: number, 
        raceConfig: RaceConfiguration, 
        targetMultipliers: {[key: string]: number},
        rewardsMultiplier: {[key: string]: number}
    ) {
        const targetScalingMeta = this._meta.targetScaling;
        const multiplierKey = this._multiplierKey(raceConfig.tier, raceConfig.type);

        let currentMultiplier = targetMultipliers[multiplierKey] || 1;
        let scaleIndex = 1;

        if (raceConfig.rewards.length <= targetsHit) {
            // all targets were hit, increase next target and rewards
            scaleIndex = 1 - Math.tanh(raceDuration - raceConfig.durationStd);
            scaleIndex *= targetScalingMeta.targetIncreaseStep;
            if (scaleIndex < targetScalingMeta.targetIncreaseFalloff) {
                scaleIndex = 0;
            }
            currentMultiplier *= (1 + scaleIndex);
        } else {
            // not everything were hit, decrease target and rewards
            scaleIndex = 1 - targetsHit / raceConfig.rewards.length;
            scaleIndex *= targetScalingMeta.targetDecreaseStep;
            currentMultiplier *= (1 - scaleIndex);
        }

        currentMultiplier = currentMultiplier > targetScalingMeta.maxMultiplier ? targetScalingMeta.maxMultiplier : currentMultiplier;
        targetMultipliers[multiplierKey] = currentMultiplier;
        rewardsMultiplier[multiplierKey] = Math.max(targetScalingMeta.minMultiplier, Math.log(Math.pow(currentMultiplier, targetScalingMeta.rewardsPowerScale)) + 1);
    }

    private _predictMultipliers(race: Race) {
        const key = this._multiplierKey(race.tier, race.type);
        let targetMultiplier = {
            [key]: this._getTargetMultiplier(race.tier, race.type)
        };

        let rewardsMultiplier = {
            [key]: this._getRewardsMultiplier(race.tier, race.type)
        };

        this._calculateMultiplier(
            race.finalDuration, 
            race.targetsHit, 
            race.config, 
            targetMultiplier, 
            rewardsMultiplier
        );

        return { targetMultiplier: targetMultiplier[key], rewardsMultiplier: rewardsMultiplier[key] }
    }

    private _multiplierKey(tier: number|string, rankingOptions: RankingOptions): string {
        let key = `${tier}_${rankingOptions.type}`;
        switch (rankingOptions.type) {
            case RankingType.CollectedItemsByRarity:
            case RankingType.CraftedItemsByRarity:
            case RankingType.DisenchantedItemsByRarity:
            case RankingType.LevelItemsByRarity:
                key += `_${rankingOptions.rarity}`;
                break;
        }

        return key;
    }

    private _findRaceWithUser(userId: string) {
        for (const race of this._races) {
            const hasUser = race.hasUser(userId);
            if (hasUser) {
                return race;
            }
        }

        return null;
    }

    private async _save() {
        await this._db.collection(Collections.Races).replaceOne({ _id: "state" }, this._state, { upsert: true });
    }

    private _addRace(race: Race) {
        race.on(Race.Finished, this._handleRaceFinished.bind(this));
        this._races.push(race);
    }

    private async _getRace(raceId: string) {
        let obj = ObjectId(raceId);
        const race = this._races.find(x => x.id.equals(obj));
        if (!race) {
            throw Errors.NoSuchRace;
        }
        return race;
    }

    async _handleRaceFinished(raceId: ObjectId) {
        console.log(`Race ${raceId} has been finished.`);        

        let race: Race;
        {
            const index = this._races.findIndex(x => x.id.equals(raceId));
            if (index != -1) {
                race = this._races[index];
                this._races[index].removeAllListeners(Race.Finished);
                this._races.splice(index, 1);
            }
        }

        {
            const index = this._state.runningRaces.findIndex(x => x.equals(raceId));
            if (index != -1) {
                this._state.runningRaces.splice(index, 1);
            }
        }

        if (race) {
            this._handleRaceMultipliers(race.finalDuration, race.targetsHit, race.config); 
        }

        await this._launchNewRaces();
    }
}

export default RacesManager;