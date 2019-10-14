
const TrialCards = require("./TrialCards");
import TrialType from "../knightlands-shared/trial_type";
import Game from "./../game";
import TrialCardsEffect from "../knightlands-shared/trial_cards_effect";
const { Collections } = require("../database");
import Errors from "../knightlands-shared/errors";
import CharacterStat from "../knightlands-shared/character_stat";

const FloorEnemyUnit = require("../combat/floorEnemyUnit");
const TrialPlayerUnit = require("../combat/trialPlayerUnit");

class Trials {
    constructor(state, user) {
        this._state = state;
        this._user = user;
    }

    _createTrialState() {
        return {
            trials: {},
            unlockedTrials: {},
            freeAttempts: 0,
            attempts: 0
        };
    }

    _createStageState() {
        return {
            cleared: false,
            firstTimeCleared: false,
            finishedFights: {}
        };
    }

    async init() {
        this._trialsMeta = {};

        const trialsMeta = await Game.db.collection(Collections.Meta).find({
            _id: {
                $in: [`${TrialType.Armour}_trials`, `${TrialType.Weapon}_trials`, "trials"]
            }
        }).toArray();

        const cardsRollMeta = {};

        for (let i = 0; i < trialsMeta.length; i++) {
            const meta = trialsMeta[i];
            if (meta._id == "trials") {
                this._generalTrialsMeta = meta;
            } else if (meta._id == `${TrialType.Armour}_trials`) {
                this._trialsMeta[TrialType.Armour] = meta;
                cardsRollMeta[TrialType.Armour] = {
                    cardsChoiceChance: meta.cardsChoiceChance,
                    cardsChanceIncreaseStep: meta.cardsChanceIncreaseStep
                };
            } else {
                this._trialsMeta[TrialType.Weapon] = meta;
                cardsRollMeta[TrialType.Weapon] = {
                    cardsChoiceChance: meta.cardsChoiceChance,
                    cardsChanceIncreaseStep: meta.cardsChanceIncreaseStep
                };
            }
        }

        if (!this._state[TrialType.Armour]) {
            this._state[TrialType.Armour] = this._createTrialState();

            const firstTrialId = this._trialsMeta[TrialType.Armour].trialUnlockOrder[0];
            this._state[TrialType.Armour].unlockedTrials[firstTrialId] = true;
        }

        if (!this._state[TrialType.Weapon]) {
            this._state[TrialType.Weapon] = this._createTrialState();

            const firstTrialId = this._trialsMeta[TrialType.Weapon].trialUnlockOrder[0];
            this._state[TrialType.Weapon].unlockedTrials[firstTrialId] = true;
        }

        if (!this._state.cards) {
            this._state.cards = {};
        }

        this._cards = new TrialCards(this._user, this._state.cards, this._generalTrialsMeta, cardsRollMeta);
    }

    async pickCard(cardIndex) {
        cardIndex *= 1;

        const currentFight = this._getChallengedFight(trialType);
        if (!currentFight.cards) {
            return;
        }

        if (!currentFight.cards) {
            throw Errors.TrialNoCards;
        }

        if (cardIndex < -1 || currentFight.cards.length >= cardIndex) {
            throw Errors.TrialInvalidCard;
        }

        return await this._cards.activateCard(currentFight, cardIndex);
    }

    attack(trialType) {
        const trialState = this._getTrialTypeState(trialType);
        const currentFight = this._getChallengedFight(trialType);

        const playerCombatUnit = new TrialPlayerUnit(this._user.maxStats, currentFight.playerHealth, currentFight.maxPlayerHealth);
        const enemyCombatUnit = new FloorEnemyUnit(currentFight.health, currentFight.attack);

        const attackResult = playerCombatUnit.attack(enemyCombatUnit);
        const response = {
            attackResult
        };

        if (enemyCombatUnit.isAlive) {
            enemyCombatUnit.attack(playerCombatUnit);

            // trigger cards of hate (based on chance and hits)
            response.cards = this._cards.rollCards(trialType, currentFight.hits);
            currentFight.cards = response.cards;
            currentFight.hits++;
            currentFight.health = enemyCombatUnit.getHealth();
            currentFight.playerHealth = playerCombatUnit.getHealth();
        } else {
            // set as finished
            const stageState = this._getStageState(trialType, currentFight.trialId, currentFight.stageId);
            stageState.finishedFights[currentFight.id] = true;
            response.fightFinished = true;

            const trialsMeta = this._getTrialsMeta(trialType);
            const stageMeta = this._getStageMeta(trialsMeta, trialId, currentFight.stageId);

            // check if all fights are finished
            let allFinished = true;
            for (let index = 0; index < stageMeta.fights.length; index++) {
                const fight = stageMeta.fights[index];
                if (!this._isFightFinished(stageState, fight.id)) {
                    allFinished = false;
                    break;
                }
            }

            if (allFinished) {
                stageState.cleared = true;
                stageState.firstTimeCleared = true;
                response.stageCleared = true;
            }

            trialState.currentFight = null;
        }

        return response;
    }

    challengeFight(trialType, trialId, stageId, fightIndex) {
        fightIndex *= 1;

        // get trial meta
        const trialsMeta = this._getTrialsMeta(trialType);
        if (!trialsMeta) {
            throw Errors.IncorrectArguments;
        }

        const stageMeta = this._getStageMeta(trialsMeta, trialId, stageId);

        if (!stageMeta) {
            throw Errors.IncorrectArguments;
        }

        // this stage was cleared?
        if (this._isStageCleared(trialType, trialId, stageMeta.id)) {
            throw Errors.TrialStageCleared;
        }

        const stagesMeta = trialsMeta.trials[trialId].stages;
        // previous stages were cleared?
        for (let index = 0; index < stagesMeta.length; index++) {
            const stage = stagesMeta[index];
            if (stage.id == stageMeta.id) {
                break;
            }

            if (!this._isStageCleared(trialType, trialId, stage.id)) {
                throw Errors.TrialClearPreviousStages;
            }
        }

        const fightMeta = this._getFightMeta(stageMeta, fightIndex);
        const stageState = this._getStageState(trialType, trialId, stageMeta.id);

        // if this fight already finished?
        if (this._isFightFinished(stageState, fightMeta.id)) {
            throw Errors.TrialFightFinished;
        }

        // check if all previous fights are finished
        for (let index = 0; index < stageMeta.fights.length; index++) {
            const fight = stageMeta.fights[index];
            if (fight.id == fightMeta.id) {
                break;
            }

            if (!this._isFightFinished(stageState, fight.id)) {
                throw Errors.TrialFinishPreviousFights;
            }
        }

        const trialState = this._getTrialTypeState(trialType);
        // check if player is not in fight
        if (trialState.currentFight) {
            throw Errors.TrialInFight;
        }

        // check if there is enough attempts
        if (!this._hasAttempts(trialType)) {
            throw Errors.TrialNoAttempts;
        }

        // create fight 
        trialState.currentFight = {
            playerHealth: this._user.getMaxStatValue(CharacterStat.Health),
            maxPlayerHealth: this._user.getMaxStatValue(CharacterStat.Health),
            health: fightMeta.health,
            maxHealth: fightMeta.health,
            attack: fightMeta.attack,
            stageId: stageMeta.id,
            id: fightMeta.id,
            trialId,
            hits: 0 // used for pity system
        };

        return trialState;
    }

    getTrialState(trialType, trialId) {
        if (trialId !== undefined) {
            return this._getTrialState(trialType, trialId);
        }

        const state = this._getTrialTypeState(trialType);
        return {
            currentFight: state.currentFight,
            unlockedTrials: state.unlockedTrials,
            freeAttempts: state.freeAttempts,
            attempts: state.attempts
        };
    }

    getCardsState() {
        return this._cards.state;
    }

    addAttempts(trialType, count, isFree) {
        const trialState = this._getTrialTypeState(trialType);
        if (isFree) {
            trialState.freeAttempts = count;
        } else {
            trialState.attempts += count;
        }
    }

    _hasAttempts(trialType) {
        const trialState = this._getTrialTypeState(trialType);
        return trialState.freeAttempts > 0 || trialState.attempts > 0;
    }

    _consumeAttempt(trialType) {
        const trialState = this._getTrialTypeState(trialType);
        // consume free attemp first
        if (trialState.freeAttempts > 0) {
            trialState.freeAttempts--;
        } else if (trialState.attempts > 0) {
            trialState.attempts--;
        }
    }

    _getChallengedFight(trialType) {
        const trialState = this._getTrialTypeState(trialType);
        return trialState.currentFight;
    }

    _getStageMeta(trialsMeta, trialId, stageId) {
        const trial = trialsMeta.trials[trialId];
        if (!trial) {
            throw Errors.UnknownTrial;
        }

        const stage = trial.stages[stageId];
        if (!stage) {
            throw Errors.UnknownTrialStage;
        }

        return stage;
    }

    _getFightMeta(stageMeta, fightIndex) {
        const fight = stageMeta.fights[fightIndex];
        if (!fight) {
            throw Errors.UnknownTrialFight;
        }

        return fight;
    }

    _isFightFinished(stageState, fightId) {
        return !!stageState.finishedFights[fightId];
    }

    _getStageState(trialType, trialId, stageId) {
        const state = this._getTrialState(trialType, trialId);
        if (!state.stages[stageId]) {
            state.stages[stageId] = this._createStageState();
        }
        return state.stages[stageId];
    }

    _resetStage(trialType, trialId, stageId) {
        const state = this._getStageState(trialType, trialId, stageId);
        state.finishedFights = {};
        state.cleared = false;
    }

    _isStageCleared(trialType, trialId, stageId) {
        const stageState = this._getStageState(trialType, trialId, stageId);
        if (!stageState) {
            return false;
        }

        return stageState.cleared;
    }

    _getTrialTypeState(trialType) {
        return this._state[trialType];
    }

    _getTrialState(trialType, trialId) {
        const state = this._getTrialTypeState(trialType, trialId);
        let trialState = state.trials[trialId];
        if (!trialState) {
            trialState = {
                stages: {}
            };
            state.trials[trialId] = trialState;
        }

        return trialState;
    }

    _getTrialsMeta(trialType) {
        const trialsMeta = this._trialsMeta[trialType];
        if (!trialsMeta) {
            throw Errors.UnknownTrialType;
        }
        return trialsMeta;
    }

    // Work with Database 

    async _getGeneralTrialsMeta() {
        if (!this._generalTrialsMeta) {
            this._generalTrialsMeta = await Game.db.collection(Collections.Meta).findOne({ _id: "trials" });
        }
    }
}

module.exports = Trials;