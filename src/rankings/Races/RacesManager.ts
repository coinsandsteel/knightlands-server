import { Db, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import { RacesState, RacesMeta, RaceState, RaceRecord, RaceConfiguration } from "./RaceTypes";
import { Race } from "./Race";
import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { RankingRecord, RankingOptions } from "../Ranking";
import Errors from "../../knightlands-shared/errors";
import random from "../../random";
import Game from "../../game";
import RankingType from "../../knightlands-shared/ranking_type";
import { Lock } from "../../utils/lock";
import { RaceShop } from "./RaceShop";

class RacesManager implements IRankingTypeHandler {
    private _db: Db;
    private _meta: RacesMeta;
    private _state: RacesState;
    private _races: Race[];
    private _lock: Lock;
    private _shop: RaceShop;

    constructor(db: Db) {
        this._db = db;
        this._races = [];
        this._lock = new Lock();
    }

    async init() {
        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "races" }) as RacesMeta;
        this._state = await this._db.collection(Collections.Races).findOne({ _id: "state" }) as RacesState;

        this._shop = new RaceShop(this._meta.shop);

        if (this._state) {
            await this._loadRaces();
        }

        await this._launchNewRaces();
    }

    async purchaseFromRaceShop(user: any, lotId: number) {
        await this._shop.purchaseItem(user, lotId);
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        const race = this._findRaceWithUser(userId);
        if (race) {
            let id = race.id.toHexString();
            await this._lock.acquire(id);
            await race.updateRank(userId, options, value);
            this._lock.release(id);
        }
    }

    async join(userId: string, raceId: string) {
        // if player recently won a race - wait for a cooldown
        const lastRaceRecord = await this._db.collection(Collections.RaceWinners).findOne({
            _id: userId
        });

        if (lastRaceRecord && Game.nowSec - lastRaceRecord.lastRace < this._meta.winnerCooldown) {
            throw Errors.CantJoinRace;
        }

        let race = this._findRaceWithUser(userId);
        if (race) {
            await race.remove(userId);
        }

        race = await this._getRace(raceId);
        await race.add(userId);
    }

    async claimRewards(userId: string, raceId: string) {
        let raceState = <RaceRecord>await this._db.collection(Collections.Races).findOne({
            _id: new ObjectId(raceId),
            state: RaceState.Finished,
            [`looted.${userId}`]: false
        });

        if (!raceState) {
            throw Errors.NoSuchRace;
        }

        let raceInstance = new Race(this._db);
        await raceInstance.loadFromState(raceState);

        if (!raceInstance.hasUser(userId)) {
            throw Errors.NotInRace;
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
                { _id: new ObjectId(raceId) },
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
            _id: new ObjectId(raceId)
        });

        if (!raceState) {
            throw Errors.NoSuchTournament;
        }

        let rewards = raceState.config.rewards.map((x, index) => {
            return {
                minRank: index + 1,
                maxRank: index + 1,
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

        let finishedRaces = []

        for (const raceState of races) {
            let raceInstance = new Race(this._db);
            await raceInstance.loadFromState(raceState as RaceRecord);

            let userRank = <RankingRecord>await raceInstance.getUserRank(userId);
            if (!userRank) {
                throw Errors.NotInRace;
            }

            if (userRank.rank == 0) {
                continue;
            }

            raceState.rank = userRank;

            let rewards = raceState.config.rewards.map(x => {
                return {
                    item: this._meta.shop.currencyItem,
                    quantity: this._getReward(x, raceState.config)
                };
            });

            raceState.config.rewards = rewards;
            finishedRaces.push(raceState);
        }

        return finishedRaces;
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
                maxParticipants: race.config.rewards.length,
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

        let info: any = {
            list
        };

        let currentRace = this._findRaceWithUser(userId);
        if (currentRace) {
            info.currentRace = await this.getRank(currentRace.id.toHexString(), userId);
        }

        let cooldown = await this._db.collection(Collections.RaceWinners).findOne({ _id: userId });
        info.cooldown = cooldown ? this._meta.winnerCooldown - (Game.nowSec - cooldown.lastRace) : 0;

        return info;
    }

    private _getReward(reward, config: RaceConfiguration) {
        return Math.ceil(reward * this._getRewardsMultiplier(config.tier, config.type));
    }

    private async _loadRaces() {
        console.log("RacesManager load races...");

        let races = [];
        let promises = [];
        for (const raceId of this._state.runningRaces) {
            let race = new Race(this._db);
            race.on(Race.Finished, this._handleRaceFinished.bind(this));
            promises.push(race.load(raceId));
            races.push(race);

        }

        await Promise.all(promises);

        for (const race of races) {
            this._addRace(race);
        }
    }

    private async _launchNewRaces() {
        console.log("RacesManager launch new races...");

        if (!this._state) {
            this._state = {
                tiersRunning: {},
                runningRaces: [],
                targetMultipliers: {},
                rewardsMultiplier: {}
            };
        }

        let races = [];
        let promises = [];

        for (let [tier, templates] of Object.entries(this._meta.templates)) {
            // if tier exist - skip 
            if (this._state.tiersRunning[tier]) {
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
            race.on(Race.Finished, this._handleRaceFinished.bind(this));
            this._state.tiersRunning[race.tier] = true;
        }

        const raceIds = await Promise.all(promises);
        for (const raceId of raceIds) {
            this._state.runningRaces.push(raceId);
        }

        for (const race of races) {
            this._addRace(race);
        }

        await this._save();
    }

    private _getTargetMultiplier(tier: number | string, rankingOptions: RankingOptions): number {
        const key = this._multiplierKey(tier, rankingOptions);
        return this._state.targetMultipliers[key] || 1;
    }

    private _getRewardsMultiplier(tier: number | string, rankingOptions: RankingOptions): number {
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
        targetMultipliers: { [key: string]: number },
        rewardsMultiplier: { [key: string]: number }
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
            // not every target was hit, decrease target and rewards
            scaleIndex = 1 - targetsHit / raceConfig.rewards.length;
            scaleIndex *= targetScalingMeta.targetDecreaseStep;
            currentMultiplier *= (1 - scaleIndex);
        }

        currentMultiplier = Math.max(
            targetScalingMeta.minMultiplier,
            currentMultiplier > targetScalingMeta.maxMultiplier ?
                targetScalingMeta.maxMultiplier : currentMultiplier
        );

        targetMultipliers[multiplierKey] = currentMultiplier;

        if (currentMultiplier > 1) {
            rewardsMultiplier[multiplierKey] = Math.max(
                targetScalingMeta.minMultiplier,
                Math.log(Math.pow(currentMultiplier, targetScalingMeta.rewardsPowerScale)) + 1
            );
        } else {
            rewardsMultiplier[multiplierKey] = currentMultiplier;
        }
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

    private _multiplierKey(tier: number | string, rankingOptions: RankingOptions): string {
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
        if (race.finished) {
            // sometimes during load race might finish, handle this edge case
            return;
        }

        this._races.push(race);
    }

    private async _getRace(raceId: string) {
        let obj = new ObjectId(raceId);
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

            // winners should not be able to join other races for a while
            const updates = [];
            for (const winner of race.winners) {
                updates.push({
                    updateOne: {
                        filter: {
                            "_id": winner
                        },
                        update: {
                            $set: {
                                lastRace: Game.nowSec
                            }
                        },
                        upsert: true
                    }
                });
            }

            if (updates.length > 0) {
                await this._db.collection(Collections.RaceWinners).bulkWrite(updates);
            }

            delete this._state.tiersRunning[race.tier];
        }

        await this._launchNewRaces();
    }
}

export default RacesManager;
