import TrialCardsEffect from "../knightlands-shared/trial_cards_effect";
import TrialCardModifiers from "../knightlands-shared/trial_card_modifiers";
import Random from "../random";
const WeightedList = require("../js-weighted-list");
const CardsToRoll = 3;

class TrialCards {
    constructor(user, state, meta, choiceMeta) {
        this._user = user;
        this._state = state;

        if (!this._state.modifiers) {
            this._state.modifiers = {};
        }

        this._choiceMeta = choiceMeta;
        this._meta = meta;

        this._cardWeights = new WeightedList(this._meta.cardsWeights);
    }

    get state() {
        return this._state;
    }

    rollCards(trialType, hitsCount) {
        // hitsCount used for pity system
        if (hitsCount == 0) {
            // always trigger
            return this._rollCardsAndResetIncreasedRollChance(trialType);
        }

        const chanceInc = this._getCardsChanceRollIncrease(trialType);
        const choiceMeta = this._choiceMeta[trialType];
        if (Random.intRange(0, 100) <= choiceMeta.cardsChoiceChance + chanceInc) {
            return this._rollCardsAndResetIncreasedRollChance(trialType);
        }

        this._setCardsChanceRollIncrease(trialType, chanceInc + choiceMeta.cardsChanceIncreaseStep);
    }

    async activateCard(fightState, fightMeta, cardIndex) {
        const cardEffect = fightState.cards[cardIndex];
        const cardMeta = fightMeta.cards[cardEffect];
        const modValue = this._modifyValue(cardMeta.value, cardModifierType);

        const response = {
            value: modValue,
            effect: cardEffect
        };

        switch (cardEffect) {
            case TrialCardsEffect.GiveResource:
                await this._user.inventory.autoCommitChanges(async inv => {
                    await inv.addItemTemplate(modifier.itemId, modValue);
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

    addPoints(points) {
        this._state.points = (this._state.points || 0) + points;
    }

    _modifyValue(value, cardModifierType) {
        const modifier = this._meta.cardModifiers[cardModifierType];

        // no modifier, do not do anything
        if (!modifier) {
            return value;
        }

        const level = (this._state.modifiers[cardModifierType] || 0);
        const modValue = modifier.levels[level];

        switch (modifier.type) {
            case TrialCardModifiers.FlatValue:
                value += modValue;
                break;

            case TrialCardModifiers.IncreaseRelatively:
                value = Math.floor(value * (100 + modValue) / 100);
                break;

            case TrialCardModifiers.DecreaseRelatively:
                value = Math.floor(value * (100 - modValue) / 100);
                break;
        }

        return value;
    }

    _rollCardsAndResetIncreasedRollChance(trialType) {
        this._setCardsChanceRollIncrease(trialType, 0);
        return this._cardWeights.peek(CardsToRoll);
    }

    _getCardsState(trialType) {
        const state = this._state[trialType];
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