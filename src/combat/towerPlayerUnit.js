const Unit = require("./unit");

class TowerPlayerUnit extends Unit {
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
}

module.exports = TowerPlayerUnit;