import { Db } from "mongodb";
import { Collections } from "../database";
import { Tournaments, TournamentsMeta, TournamentState, TournamentRecord } from "./TournamentTypes";
import { Tournament } from "./Tournament";
import { IRankingTypeHandler } from "./IRankingTypeHandler";
import { RankingOptions, RankingRecord } from "./Ranking";
import Errors from "../knightlands-shared/errors";
import random from "../random";
import Game from "../game";

class TournamentsManager implements IRankingTypeHandler {
    _db: Db;
    _meta: TournamentsMeta;
    _state: Tournaments;
    _tournamets: Tournament[];

    constructor(db: Db) {
        this._db = db;
        this._tournamets = [];
    }

    async init() {
        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "tournaments" });
        this._state = await this._db.collection(Collections.Tournaments).findOne({ _id: "state" });

        if (!this._state) {
            await this._launchNewTournaments();
        } else {
            await this._loadTournaments();
        }
    }

    async updateRank(userId: string, options: RankingOptions, value: number) {
        // find where player is participating now
        for (const tournament of this._tournamets) {
            const hasUser = tournament.hasUser(userId);
            if (hasUser) {
                await tournament.updateRank(userId, options, value);
            }
        }
    }

    async claimRewards(userId: string, tournamentId: string) {
        let tournamentState = <TournamentRecord>await this._db.collection(Collections.Tournaments).findOne({
            _id: tournamentId,
            state: TournamentState.Finished,
            [`loot.${userId}`]: { $exists: false }
        });

        if (!tournamentState) {
            throw Errors.NoSuchTournament;
        }

        let tournamentInstance = new Tournament(this._db);
        tournamentInstance.loadFromState(tournamentState);

        if (!tournamentInstance.hasUser(userId)) {
            throw Errors.NotInTournament;
        }

        let userRank = <RankingRecord>await tournamentInstance.getUserRank(userId);
        if (!userRank) {
            throw Errors.NotInTournament;
        }

        const rewards = tournamentState.rewards.find(x => x.minRank <= userRank.rank && x.maxRank >= userRank.rank);
        const loot = await Game.lootGenerator.getLootFromTable(rewards.loot);

        await this._db.collection(Collections.TournamentTables)
            .updateOne(
                { _id: tournamentId },
                {
                    $set: { [`loot.${userId}`]: true }
                }
            );

        return loot;
    }

    async join(userId: string, tournamentId: string) {
        for (const tournament of this._tournamets) {
            const hasUser = tournament.hasUser(userId);
            if (hasUser) {
                await tournament.remove(userId);
            }
        }

        const tournament = await this._getTournament(tournamentId);
        await tournament.add(userId);
    }

    async _getTournament(tournamentId: string) {
        const tournament = this._tournamets.find(x => x.id == tournamentId);
        if (!tournament) {
            throw Errors.NoSuchTournament;
        }
        return tournament;
    }

    getRunningTournaments() {
        let list = [];
        for (const t of this._tournamets) {
            list.push(t.clientInfo());
        }
        return list;
    }

    async _loadTournaments() {
        console.log("TournamentsManager schedule tournaments finish...");

        let tournaments = [];
        for (const tournamentId of this._state.runningTournaments) {
            let tournament = new Tournament(this._db);

            tournaments.push(tournament.load(tournamentId));
            this._addTournament(tournament);
        }

        await Promise.all(tournaments);
    }

    async _launchNewTournaments() {
        console.log("TournamentsManager launch new tournaments...");

        if (!this._state) {
            this._state = {
                runningTournaments: []
            };
        }

        let tournaments = [];

        for (let [tier, template] of Object.entries(this._meta.templates)) {
            // if tournament exist - skip 
            if (this._tournamets.find(x => x._state.tier == tier)) {
                continue;
            }

            let tournament = new Tournament(this._db);

            const rewards = random.pick(this._meta.rewards[tier]);
            const typeOptions = random.pick(template.types);

            tournaments.push(tournament.create(tier, typeOptions, template.duration, rewards));
            this._addTournament(tournament);
        }

        const tournamentIds = await Promise.all(tournaments);
        for (const tournamentId of tournamentIds) {
            this._state.runningTournaments.push(tournamentId.valueOf());
        }

        await this._db.collection(Collections.Tournaments).updateOne({ _id: "state" }, { $set: this._state }, { upsert: true });
    }

    _addTournament(tournament: Tournament) {
        tournament.on(Tournament.Finished, this._handleTournametFinished.bind(this));
        this._tournamets.push(tournament);
    }

    async _handleTournametFinished(tournamentId: string) {
        console.log(`Tournament ${tournamentId} has been finished.`);

        {
            const index = this._tournamets.findIndex(x => x.id == tournamentId);
            if (index != -1) {
                this._tournamets.splice(index, 1);
            }
        }

        {
            const index = this._state.runningTournaments.findIndex(x => x == tournamentId);
            if (index != -1) {
                this._state.runningTournaments.splice(index, 1);
            }
        }

        await this._launchNewTournaments();
    }
};

export default TournamentsManager;