import TrialCardsEffect from "../knightlands-shared/trial_cards_effect";
import TrialCardModifiers from "../knightlands-shared/trial_card_modifiers";
import TrialCardsResolver from "../knightlands-shared/trial_cards_resolver";
import Random from "../random";
import Errors from "../knightlands-shared/errors";
const WeightedList = require("../js-weighted-list");
const CardsToRoll = 4;

class TrialCards {
    constructor(user, state, meta, choiceMeta) {
        this._user = user;
        this._state = state;

        if (!this._state.modifiers) {
            this._state.modifiers = {};
            this._state.points = 0;
            this._state.totalPoints = 0;
        }

        this._choiceMeta = choiceMeta;
        this._meta = meta;

        this._cardWeights = new WeightedList(this._meta.cardWeights.weights);
        this._resolver = new TrialCardsResolver(this._state.modifiers, this._meta.cardModifiers);
    }

    get mana() {
        return this._state.mana || 0;
    }

    set mana(value) {
        if (value > this._meta.maxMana) {
            value = this._meta.maxMana;
        }

        this._state.mana = value;
    }

    get state() {
        return this._state;
    }

    get points() {
        return this._state.points || 0;
    }

    set points(value) {
        this._state.points = value;
    }

    get totalPoints() {
        return this._state.totalPoints || 0;
    }

    set totalPoints(value) {
        this._state.totalPoints = value;
    }

    rollCards(trialType, hitsCount) {
        if (this.mana < this._meta.cardSummonCost) {
            throw Errors.TrialsNotEnoughMana;
        }

        this.mana -= this._meta.cardSummonCost;
        // hitsCount used for pity system
        // if (hitsCount == 0) {
        //     // always trigger
        //     return this._rollCardsAndResetIncreasedRollChance(trialType);
        // }

        // const chanceInc = this._getCardsChanceRollIncrease(trialType);
        // const choiceMeta = this._choiceMeta[trialType];
        // if (Random.intRange(0, 100) <= choiceMeta.cardsChoiceChance + chanceInc) {
        //     return this._rollCardsAndResetIncreasedRollChance(trialType);
        // }

        // this._setCardsChanceRollIncrease(trialType, chanceInc + choiceMeta.cardsChanceIncreaseStep);
        return this._rollCardsAndResetIncreasedRollChance(trialType);
    }

    async activateCard(fightState, fightMeta, cardIndex) {
        const cardEffect = Random.shuffle(fightState.cards)[cardIndex];
        const modValue = this._resolver.getCurrentValue(fightMeta, cardEffect);

        const response = {
            value: modValue,
            effect: cardEffect
        };

        switch (cardEffect) {
            case TrialCardsEffect.GiveResource:
                await this._user.inventory.autoCommitChanges(async inv => {
                    await inv.addItemTemplate(fightMeta.cards[cardEffect].item, modValue);
                });
                break;

            case TrialCardsEffect.GiveGold:
                this._user.addSoftCurrency(modValue, true);
                break;

            case TrialCardsEffect.GiveExp:
                await this._user.addExperience(modValue);
                break;

            case TrialCardsEffect.DamageEnemy:
                fightState.health -= modValue;
                break;

            case TrialCardsEffect.DamagePlayer:
                fightState.playerHealth -= modValue;
                break;

            case TrialCardsEffect.HealPlayer:
                fightState.playerHealth += modValue;
                if (fightState.playerHealth > fightState.playerMaxHealth) {
                    fightState.playerHealth = fightState.playerMaxHealth;
                }
                break;
        }

        return response;
    }

    improveCard(cardEffect) {
        const modifier = this._getModifierMeta(cardEffect);
        if (!modifier) {
            throw Errors.TrialInvalidCard;
        }

        let level = this._getCardLevel(cardEffect);
        if (modifier.levels.length <= level) {
            throw Errors.TrialCardMaxLevel;
        }

        level += 1;

        const upgradeCost = this._meta.upgradeCost[level];
        if (this.points < upgradeCost) {
            throw Errors.TrialNotEnoughPoints;
        }

        this.points -= upgradeCost;
        this._setCardLevel(cardEffect, level);
    }

    addPoints(points) {
        this.points += points;
        this.totalPoints += points;
    }

    get resetResetPrice() {
        return this._resolver.getResetPrice(this.totalPoints - this.points);
    }

    resetPoints() {
        if (this.resetResetPrice > this._user.softCurrency) {
            throw Errors.NotEnoughSoft;
        }

        this._user.addSoftCurrency(-this.resetResetPrice);
        this.points = this.totalPoints;
        // reset all cards to 0 level
        for (const i in this._state.modifiers) {
            this._state.modifiers[i] = 0;
        }
    }

    _setCardLevel(cardEffect, level) {
        this._state.modifiers[cardEffect] = level;
    }

    _getCardLevel(cardEffect) {
        return (this._state.modifiers[cardEffect] || 0);
    }

    _getModifierMeta(cardEffect) {
        return this._meta.cardModifiers[cardEffect];
    }

    _rollCardsAndResetIncreasedRollChance(trialType) {
        // this._setCardsChanceRollIncrease(trialType, 0);
        return this._cardWeights.peek(this._meta.cardsToRoll);
    }

    _getCardsState(trialType) {
        let state = this._state[trialType];
        if (!state) {
            state = {
                rollInc: 0
            };
            this._state[trialType] = state;
        }
        return state;
    }

    _getCardsChanceRollIncrease(trialType) {
        return this._getCardsState(trialType).rollInc;
    }

    _setCardsChanceRollIncrease(trialType, value) {
        this._getCardsState(trialType).rollInc = value;
    }
}

module.exports = TrialCards;