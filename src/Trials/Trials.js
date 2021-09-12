import TrialCards from "./TrialCards";
import TrialType from "../knightlands-shared/trial_type";
import Game from "../game";
import Elements from "../knightlands-shared/elements";
const { Collections } = require("../database/database");
import Errors from "../knightlands-shared/errors";
import CharacterStat from "../knightlands-shared/character_stat";
import random from "../random";

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
            freeAttempts: 3,
            attempts: 0
        };
    }

    _createStageState() {
        return {
            collected: false,
            cleared: false,
            firstTimeCleared: false,
            finishedFights: {}
        };
    }

    async init() {
        this._trialsMeta = {};

        const trialsMeta = await Game.db.collection(Collections.Meta).find({
            _id: {
                $in: [`${TrialType.Armour}_trials`, `${TrialType.Weapon}_trials`, `${TrialType.Accessory}_trials`, "trials"]
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
            } else if (meta._id == `${TrialType.Weapon}_trials`) {
                this._trialsMeta[TrialType.Weapon] = meta;
                cardsRollMeta[TrialType.Weapon] = {
                    cardsChoiceChance: meta.cardsChoiceChance,
                    cardsChanceIncreaseStep: meta.cardsChanceIncreaseStep
                };
            } else if (meta._id == `${TrialType.Accessory}_trials`) {
                this._trialsMeta[TrialType.Accessory] = meta;
                cardsRollMeta[TrialType.Accessory] = {
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

            const trialMeta = this._trialsMeta[TrialType.Weapon];
            const firstTrialId = trialMeta.trialUnlockOrder[0];
            this._state[TrialType.Weapon].unlockedTrials[firstTrialId] = true;

            // randomize stage element
            const stageElements = {};
            // to ensure consistency it won't be total random but instead we will use randomized order of all possible elements
            const shuffledElements = random.shuffle([Elements.Water, Elements.Earth, Elements.Light, Elements.Darkness]);
            // loop through all trials and stages and just assign elements
            let stageIndex = 0;
            for (let i in trialMeta.trials) {
                const trialFightMeta = trialMeta.trials[i];
                for (let stageId in trialFightMeta.stages) {
                    stageElements[stageId] = shuffledElements[stageIndex % shuffledElements.length];
                    stageIndex++;
                }
            }

            this._state[TrialType.Weapon].elements = stageElements;
        }

        if (!this._state[TrialType.Accessory]) {
            this._state[TrialType.Accessory] = this._createTrialState();

            const firstTrialId = this._trialsMeta[TrialType.Accessory].trialUnlockOrder[0];
            this._state[TrialType.Accessory].unlockedTrials[firstTrialId] = true;
        }

        if (!this._state.cards) {
            this._state.cards = {};
        }

        this._cards = new TrialCards(this._user, this._state.cards, this._generalTrialsMeta, cardsRollMeta);

        await this._tryAdvanceToNextTrial(TrialType.Armour);
        await this._tryAdvanceToNextTrial(TrialType.Weapon);
        await this._tryAdvanceToNextTrial(TrialType.Accessory);
    }

    async purchaseAttempts(trialType, iapIndex) {
        if (this._state[trialType].purchased) {
            throw Errors.AlreadyPurchased;
        }

        const meta = this._trialsMeta[trialType];
        if (meta.iaps.length <= iapIndex) {
            throw Errors.IncorrectArguments;
        }

        const iapMeta = meta.iaps[iapIndex];

        if (this._user.hardCurrency < iapMeta.price) {
            throw Errors.NotEnoughCurrency;
        }

        await this._user.addHardCurrency(-iapMeta.price);
        this._user.grantTrialAttempts(trialType, iapMeta.attempts);
        this._state[trialType].purchased = true;
    }

    async pickCard(trialType, cardIndex) {
        cardIndex *= 1;

        const currentFight = this._getChallengedFight(trialType);
        if (!currentFight.cards) {
            throw Errors.TrialNoCards;
        }

        if (cardIndex < -1 || cardIndex >= currentFight.cards.length) {
            throw Errors.TrialInvalidCard;
        }

        const trialsMeta = this._getTrialsMeta(trialType);
        const stageMeta = this._getStageMeta(trialsMeta, currentFight.trialId, currentFight.stageId);
        const fightMeta = this._getFightMeta(stageMeta, currentFight.index);
        const response = await this._cards.activateCard(currentFight, fightMeta, cardIndex);

        await this.tryFinishFight(trialType, currentFight);

        delete currentFight.cards;

        return response;
    }

    async summonTrialCards(trialType) {
        const currentFight = this._getChallengedFight(trialType);
        if (!currentFight) {
            throw Errors.TrialFightFinished;
        }

        if (currentFight.cards) {
            return currentFight.cards;
        }

        // trigger cards of hate (based on chance and hits)
        const cards = this._cards.rollCards(trialType, currentFight.hits);
        if (cards) {
            currentFight.cards = cards;
        }

        return cards;
    }

    async attack(trialType) {
        const currentFight = this._getChallengedFight(trialType);
        if (!currentFight) {
            throw Errors.TrialFightFinished;
        }

        if (trialType == TrialType.Accessory) {
            // check if there is enough attempts
            if (!this._hasAttempts(trialType)) {
                throw Errors.TrialNoAttempts;
            }

            // accessory trial consumes on every attack instead
            this._consumeAttempt(trialType);
        }

        const playerCombatUnit = new TrialPlayerUnit(this._user.maxStats, currentFight.playerHealth, currentFight.maxPlayerHealth, currentFight.level);
        const enemyCombatUnit = new FloorEnemyUnit(currentFight.attack, currentFight.health);

        const trialsMeta = this._getTrialsMeta(trialType);
        const trialsState = this._getTrialTypeState(trialType);
        const stageMeta = this._getStageMeta(trialsMeta, currentFight.trialId, currentFight.stageId);
        let attackPenalty = 1;
        // apply penalty if stage's element is not physical 
        if (trialType == TrialType.Weapon) {
            const weaponCombatData = await this._user.getWeaponCombatData();
            const element = trialsState.elements[stageMeta.id];
            // no weapon or element doesn't match
            if (!weaponCombatData || element != weaponCombatData.element) {
                attackPenalty = trialsMeta.unmatchedElementPenalty;
            }
        }

        playerCombatUnit.attackPenalty = attackPenalty;
        const attackResult = playerCombatUnit.attack(enemyCombatUnit);
        const response = {
            attackResult
        };

        if (enemyCombatUnit.isAlive) {
            enemyCombatUnit.attack(playerCombatUnit);
        }

        currentFight.health = enemyCombatUnit.getHealth();
        currentFight.playerHealth = playerCombatUnit.getHealth();

        attackResult.enemyHealth = currentFight.health;
        attackResult.playerHealth = currentFight.playerHealth;

        const fightFinished = await this.tryFinishFight(trialType, currentFight);
        if (fightFinished) {
            response.fightFinished = true;
        } else {
            currentFight.hits++;
        }

        if (trialType == TrialType.Armour) {
            await this._user.dailyQuests.onArmourTrialsEngaged(1);
        } else if (trialType == TrialType.Weapon) {
            await this._user.dailyQuests.onWeaponTrialsEngaged(1);
        } else if (trialType == TrialType.Accessory) {
            await this._user.dailyQuests.onAccessoryTrialsEngaged(1);
        }


        return response;
    }

    async tryFinishFight(trialType, currentFight) {
        if (currentFight.health <= 0 || currentFight.playerHealth <= 0) {
            await this.finishCurrentFight(trialType, currentFight);
            return true;
        }

        return false;
    }

    async finishCurrentFight(trialType, currentFight) {
        if (currentFight.playerHealth > 0) {
            const stageState = this._getStageState(trialType, currentFight.trialId, currentFight.stageId);
            stageState.finishedFights[currentFight.id] = true;

            const trialsMeta = this._getTrialsMeta(trialType);
            const stageMeta = this._getStageMeta(trialsMeta, currentFight.trialId, currentFight.stageId);
            // reward soft and exp
            const fightMeta = this._getFightMeta(stageMeta, currentFight.index);
            await this._user.addSoftCurrency(fightMeta.soft);
            await this._user.addExperience(fightMeta.exp);

            this._cards.mana += this._generalTrialsMeta.manaPerFight;

            // check if all fights are finished within current stage
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
                stageState.finishedFights = {};

                // if first time clear - grant card leveling points
                if (!stageState.firstTimeCleared) {
                    // TODO move to database?
                    this._cards.addPoints(1);
                }
            }

            await this._tryAdvanceToNextTrial(trialType);
        }

        delete this._getTrialTypeState(trialType).currentFight;
    }

    challengeFight(trialType, trialId, stageId, fightIndex) {
        fightIndex *= 1;

        const trialsMeta = this._getTrialsMeta(trialType);
        const stageMeta = this._getStageMeta(trialsMeta, trialId, stageId);
        const stageState = this._getStageState(trialType, trialId, stageMeta.id);

        // this stage was cleared and no collected yet
        if (stageState.cleared && !stageState.collected) {
            throw Errors.TrialStageCleared;
        }

        const stagesOrder = trialsMeta.trials[trialId].stagesOrder;
        // previous stages were cleared?
        for (let index = 0; index < stagesOrder.length; index++) {
            const stageOrderId = stagesOrder[index];
            if (stageOrderId == stageMeta.id) {
                break;
            }

            if (!this._isStageCleared(trialType, trialId, stageOrderId)) {
                throw Errors.TrialClearPreviousStages;
            }
        }

        const fightMeta = this._getFightMeta(stageMeta, fightIndex);

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

        if (trialType != TrialType.Accessory) {
            // accessory trial consumes on every attack instead
            this._consumeAttempt(trialType);
        }

        stageState.cleared = false;
        stageState.collected = false;

        // create fight 
        trialState.currentFight = {
            playerHealth: this._user.getMaxStatValue(CharacterStat.Health),
            maxPlayerHealth: this._user.getMaxStatValue(CharacterStat.Health),
            health: fightMeta.health,
            maxHealth: fightMeta.health,
            attack: fightMeta.attack,
            stageId: stageMeta.id,
            id: fightMeta.id,
            level: this._user.level,
            index: fightIndex,
            stageId,
            trialId,
            hits: 0 // used for pity system
        };

        return trialState;
    }

    async collectTrialStageReward(trialType, trialId, stageId) {
        const trialState = this._getTrialTypeState(trialType);
        // check if player is not in fight
        if (trialState.currentFight) {
            throw Errors.TrialInFight;
        }

        const trialsMeta = this._getTrialsMeta(trialType);
        const stageMeta = this._getStageMeta(trialsMeta, trialId, stageId);
        const stageState = this._getStageState(trialType, trialId, stageId);

        if (!stageState.cleared) {
            throw Errors.TrialStageNotCleared;
        }

        if (stageState.collected) {
            throw Errors.TrialStageRewardCollected;
        }

        let rewardPreset;
        if (stageState.firstTimeCleared) {
            rewardPreset = stageMeta.repeatedReward;
        } else {
            stageState.firstTimeCleared = true;
            rewardPreset = stageMeta.firstClearanceReward;
        }

        const items = await Game.lootGenerator.getLootFromTable(rewardPreset.loot);
        await this._user.inventory.addItemTemplates(items);

        const softCollected = await this._user.addSoftCurrency(rewardPreset.soft, true);
        const expCollected = await this._user.addExperience(rewardPreset.exp, true);

        stageState.collected = true;

        return {
            items,
            soft: softCollected,
            exp: expCollected
        };
    }

    improveCard(cardEffect) {
        this._cards.improveCard(cardEffect);
    }

    async resetPoints() {
        await this._cards.resetPoints();
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

    fetchFightMeta(trialType, trialId, stageId, fightIndex) {
        fightIndex *= 1;

        const trialsMeta = this._getTrialsMeta(trialType);
        const stageMeta = this._getStageMeta(trialsMeta, trialId, stageId);

        return this._getFightMeta(stageMeta, fightIndex);
    }

    addAttempts(trialType, count, isFree, extra) {
        const trialState = this._getTrialTypeState(trialType);
        if (isFree) {
            if (extra) {
                trialState.freeAttempts += count;
            } else {
                trialState.freeAttempts = count;
            }
        } else {
            trialState.attempts += count;
        }
    }

    resetPurchases() {
        this._state[TrialType.Accessory].purchased = false;
        this._state[TrialType.Armour].purchased = false;
        this._state[TrialType.Weapon].purchased = false;
    }

    _tryAdvanceToNextTrial(trialType) {
        const state = this._getTrialTypeState(trialType);

        // find last trial id cleared
        const unlockOrder = this._trialsMeta[trialType].trialUnlockOrder;
        let trialId = -1;
        let nextTrialId = -1; {
            let i = 0;
            for (; i < unlockOrder.length; ++i) {
                const trialOrderId = unlockOrder[i];
                if (!state.unlockedTrials[trialOrderId]) {
                    nextTrialId = trialOrderId;
                    break;
                }

                trialId = trialOrderId;
            }
        }

        if (nextTrialId == -1) {
            // every trial is unlocked
            return;
        }

        const trialsMeta = this._getTrialsMeta(trialType);
        const trialMeta = trialsMeta.trials[trialId];
        const trialState = this._getTrialState(trialType, trialId);

        let stagesCompleted = true;
        for (const stageId in trialMeta.stages) {
            const stageState = trialState.stages[stageId];

            if (!stageState || (!stageState.firstTimeCleared && !stageState.cleared)) {
                stagesCompleted = false;
                break;
            }
        }

        if (stagesCompleted) {
            state.unlockedTrials[nextTrialId] = true;
        }
    }

    _hasAttempts(trialType) {
        const trialState = this._getTrialTypeState(trialType);
        let purchasedAttempts = trialState.attempts;

        if (trialState.freeAttempts <= 0) {
            const ticketItem = this._user.inventory.getItemByTemplate(this._getTrialsMeta(trialType).ticketItem);
            if (ticketItem) {
                purchasedAttempts += ticketItem.count;
            }
        }

        return trialState.freeAttempts > 0 || purchasedAttempts > 0;
    }

    _consumeAttempt(trialType) {
        const trialState = this._getTrialTypeState(trialType);
        // consume free attemp first
        if (trialState.freeAttempts > 0) {
            trialState.freeAttempts--;
        } else if (trialState.attempts > 0) {
            trialState.attempts--;
        } else {
            const ticketItem = this._user.inventory.getItemByTemplate(this._getTrialsMeta(trialType).ticketItem);
            if (ticketItem) {
                this._user.inventory.removeItem(ticketItem.id, 1);
            }
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
        const state = this._state[trialType];
        if (!state) {
            throw Errors.UnknownTrialType;
        }
        return state;
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