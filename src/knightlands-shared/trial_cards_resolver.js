import TrialCardModifiers from "./trial_card_modifiers";

class TrialCardsResolver {
    constructor(leveledModifiers, cardModifiers) {
        this._leveledModifiers = leveledModifiers;
        this._cardModifiers = cardModifiers;
    }

    getResetPrice(pointsSpent) {
        return pointsSpent * 2500;
    }

    getCurrentValue(fightMeta, cardEffect) {
        const cardMeta = fightMeta && fightMeta.cards ? fightMeta.cards[cardEffect] : null;
        const cardBaseValue = cardMeta ? cardMeta.value : 0;
        const modValue = this._modifyValue(cardBaseValue, cardEffect);
        return modValue;
    }

    isMaxLevel(cardEffect) {
        let level = (this._leveledModifiers[cardEffect] || 0);
        return modifier.levels.length <= level + 1;
    }   

    getModifierValue(cardEffect, next = false) {
        let level = (this._leveledModifiers[cardEffect] || 0);
        if (next) {
            level++;
        }

        const modifier = this._cardModifiers[cardEffect];
        if (!modifier) {
            return 0;
        }

        if (modifier.levels.length <= level) {
            level = modifier.levels.length - 1;
        }

        return modifier.levels[level].value;
    }

    getNextModifierValue(cardEffect) {
        return this.getModifierValue(cardEffect, true);
    }

    _modifyValue(value, cardEffect) {
        const modifier = this._cardModifiers[cardEffect];

        // no modifier, do not do anything
        if (!modifier) {
            return value;
        }

        const modValue = this.getModifierValue(cardEffect);

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
}

export default TrialCardsResolver;