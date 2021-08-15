const Unit = require("./unit");
import CharacterStats from "../knightlands-shared/character_stat";

class FloorEnemyUnit extends Unit {
    constructor(attack, currentHealth, level) {
        let currentStats = {};

        currentStats[CharacterStats.Attack] = attack;
        currentStats[CharacterStats.Health] = currentHealth;

        super(currentStats, {...currentStats}, level);
    }
}

module.exports = FloorEnemyUnit;
