import { Db, ObjectId } from "mongodb";
import { Collections } from "../../database/database";
import { TournamentsState, TournamentsMeta, TournamentState, TournamentRecord, TournamentDivTokenRewards, TournamentRewardsMeta, TournamentRewardSchema } from "./TournamentTypes";
import { Tournament } from "./Tournament";
import { IRankingTypeHandler } from "../IRankingTypeHandler";
import { RankingOptions, RankingRecord } from "../Ranking";
import Errors from "../../knightlands-shared/errors";
import random from "../../random";
import Game from "../../game";

class TournamentsManager implements IRankingTypeHandler {
    private _db: Db;
    private _meta: TournamentsMeta;
    private _state: TournamentsState;
    private _tournamets: Tournament[];
    private _tiersRunning: { [key: number]: boolean };

    constructor(db: Db) {
        this._db = db;
        this._tournamets = [];
        this._tiersRunning = {};
    }

    async init() {
        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "tournaments" }) as TournamentsMeta;
        this._state = await this._db.collection(Collections.Tournaments).findOne({ _id: "state" }) as TournamentsState;

        if (this._state) {
            await this._loadTournaments();
        }

        await this._launchNewTournaments();
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        const tournament = this._findTournamentWithUser(userId);
        if (tournament) {
            await tournament.updateRank(userId, options, value);
        }
    }

    async getFinishedTournaments(userId: string) {
        let tournaments = await this._db.collection(Collections.Tournaments).aggregate([
            {
                $match: {
                    state: TournamentState.Finished,
                    [`looted.${userId}`]: false
                }
            },
            {
                $project: {
                    looted: 0,
                    state: 0,
                    startTime: 0,
                    duration: 0
                }
            }
        ]).toArray();

        for (const tournamentState of tournaments) {
            let tournamentInstance = new Tournament(this._db);
            await tournamentInstance.loadFromState(tournamentState as TournamentRecord);

            let userRank = <RankingRecord>await tournamentInstance.getUserRank(userId);
            if (!userRank) {
                throw Errors.NotInTournament;
            }

            const rewards = tournamentState.rewards.rewards.find(x => x.minRank <= userRank.rank && x.maxRank >= userRank.rank);
            if (!rewards) {
                continue;
            }

            tournamentState.rewards = rewards.loot;
            tournamentState.rank = userRank;
        }

        return tournaments;
    }

    async getRewards(tournamentId: string) {
        let tournamentState = <TournamentRecord>await this._db.collection(Collections.Tournaments).findOne({
            _id: new ObjectId(tournamentId)
        }, { projection: { rewards: 1, divTokenRewards: 1 } });

        if (!tournamentState) {
            throw Errors.NoSuchTournament;
        }

        return tournamentState.rewards.rewards.map(x => {
            let copyX = {
                ...x,
                dkt: 0
            };

            copyX.loot = x.loot.guaranteedRecords;
            // spread between ranks
            copyX.dkt = this._getDivTokensReward(tournamentState.divTokenRewards, x);
            return copyX;
        })
    }

    async claimRewards(userId: string, tournamentId: string) {
        let tournamentState = <TournamentRecord>await this._db.collection(Collections.Tournaments).findOne({
            _id: new ObjectId(tournamentId),
            state: TournamentState.Finished,
            [`looted.${userId}`]: false
        });

        if (!tournamentState) {
            throw Errors.NoSuchTournament;
        }

        let tournamentInstance = new Tournament(this._db);
        await tournamentInstance.loadFromState(tournamentState);

        if (!tournamentInstance.hasUser(userId)) {
            throw Errors.NotInTournament;
        }

        let userRank = <RankingRecord>await tournamentInstance.getUserRank(userId);
        if (!userRank) {
            throw Errors.NotInTournament;
        }

        const rewards = tournamentState.rewards.rewards.find(x => x.minRank <= userRank.rank && x.maxRank >= userRank.rank);
        if (!rewards) {
            throw Errors.NoRewards;
        }

        const loot = await Game.lootGenerator.getLootFromTable(rewards.loot);

        // calcualte divs token reward
        const tokens = this._getDivTokensReward(tournamentState.divTokenRewards, rewards);

        await this._db.collection(Collections.Tournaments)
            .updateOne(
                { _id: new ObjectId(tournamentId) },
                {
                    $set: { [`looted.${userId}`]: true }
                }
            );

        return {
            loot,
            tokens
        };
    }

    async join(userId: string, tournamentId: string) {
        let tournament = this._findTournamentWithUser(userId);
        if (tournament) {
            await tournament.remove(userId);
        }

        tournament = await this._getTournament(tournamentId);
        await tournament.add(userId);
    }

    async getRankings(tournamentId: string, page: number) {
        const tournament = await this._getTournament(tournamentId);
        return await tournament.getRankings(page);
    }

    async getRank(tournamentId: string, userId: string) {
        let tournament = await this._getTournament(tournamentId);
        if (tournament) {
            return {
                id: tournament.id,
                rank: (await tournament.getUserRank(userId))
            };
        }

        return null;
    }

    async getTournamentsInfo(userId: string) {
        let list = [];
        for (const t of this._tournamets) {
            list.push(t.clientInfo());
        }

        let info: any = {
            list
        };

        let currentTournament = this._findTournamentWithUser(userId);
        if (currentTournament) {
            info.currentTournament = await this.getRank(currentTournament.id.toHexString(), userId);
        }

        return info;
    }

    private _getDivTokensReward(divRewards: TournamentDivTokenRewards, rankRewards: TournamentRewardSchema) {
        return divRewards.tokenPool * rankRewards.dkt / (rankRewards.maxRank - rankRewards.minRank + 1);
    }

    private async _getTournament(tournamentId: string) {
        let obj = new ObjectId(tournamentId);
        const tournament = this._tournamets.find(x => x.id.equals(obj));
        if (!tournament) {
            throw Errors.NoSuchTournament;
        }
        return tournament;
    }

    private async _loadTournaments() {
        console.log("TournamentsManager load tournaments...");

        let promises = [];
        let tournaments = [];
        for (const tournamentId of this._state.runningTournaments) {
            let tournament = new Tournament(this._db);

            promises.push(tournament.load(tournamentId));
            tournaments.push(tournament);
        }

        await Promise.all(promises);
        for (const tourney of tournaments) {
            this._addTournament(tourney);
        }
    }

    private async _launchNewTournaments() {
        console.log("TournamentsManager launch new tournaments...");

        if (!this._state) {
            this._state = {
                runningTournaments: []
            };
        }

        let tournaments = [];
        let promises = [];
        for (let [tier, template] of Object.entries(this._meta.templates)) {
            // if tournament exist - skip 
            if (this._tiersRunning[tier]) {
                continue;
            }

            let tournament = new Tournament(this._db);

            const rewards: TournamentRewardsMeta = random.pick(this._meta.rewards[tier]);
            const typeOptions = random.pick(template.types);

            const divTokenRewards = await this._getDivTokenRewards(rewards.dktPoolSize);

            promises.push(tournament.create(tier, typeOptions, template.duration, rewards, divTokenRewards));
            tournaments.push(tournament);
            this._tiersRunning[tournament.tier] = true;
        }

        const tournamentIds = await Promise.all(promises);
        for (const tournamentId of tournamentIds) {
            this._state.runningTournaments.push(tournamentId);
        }

        for (const tournament of tournaments) {
            this._addTournament(tournament);
        }

        await this._save();
    }

    private async _getDivTokenRewards(dktPoolSize: number): Promise<TournamentDivTokenRewards> {
        const ma = await Game.tokenAmounts.getMA(14);
        return {
            tokenPool: ma * dktPoolSize
        };
    }

    private _findTournamentWithUser(userId: string) {
        for (const tournament of this._tournamets) {
            const hasUser = tournament.hasUser(userId);
            if (hasUser) {
                return tournament;
            }
        }

        return null;
    }

    private async _save() {
        await this._db.collection(Collections.Tournaments).replaceOne({ _id: "state" }, this._state, { upsert: true });
    }

    private _addTournament(tournament: Tournament) {
        tournament.on(Tournament.Finished, this._handleTournametFinished.bind(this));
        this._tournamets.push(tournament);
        this._tiersRunning[tournament.tier] = true;
    }

    private async _handleTournametFinished(tournamentId: ObjectId) {
        console.log(`Tournament ${tournamentId} has been finished.`);
        {
            const index = this._tournamets.findIndex(x => x.id.equals(tournamentId));
            if (index != -1) {
                this._tournamets[index].removeAllListeners(Tournament.Finished);
                this._tournamets.splice(index, 1);
            }
        }

        {
            const index = this._state.runningTournaments.findIndex(x => x.equals(tournamentId));
            if (index != -1) {
                this._state.runningTournaments.splice(index, 1);
            }
        }

        await this._launchNewTournaments();
    }
};

export default TournamentsManager;
