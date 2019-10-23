const Unit = require("./unit");

class TrialPlayerUnit extends Unit {
    constructor(stats, currentHealth, maxHealth) {
        let currentStats = {
            ...stats
        };
        currentStats.health = currentHealth;

        let maxStats = {
            ...stats
        };
        maxStats.health = maxHealth;

        super(currentStats, maxStats);
    }

    get attackPenalty() {
        return this._attackPenalty;
    }

    set attackPenalty(value) {
        this._attackPenalty = value;
    }

    getAttack() {
        const attackData = super.getAttack(false);
        attackData.attack *= this.attackPenalty;
        return attackData;
    }
}

module.exports = TrialPlayerUnit;