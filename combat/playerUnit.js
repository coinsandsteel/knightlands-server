const Unit = require("./unit");
import CharacterStats from "./../knightlands-shared/character_stat";

class PlayerUnit extends Unit {
    constructor(user, stats) {
        let currentStats = {
            ...stats
        };
        currentStats.health = user.getTimerValue(CharacterStats.Health);

        super(currentStats, stats);

        this._user = user;
    }

    setHealth(value) {
        super.setHealth(value);
        this._user.setTimerValue(CharacterStats.Health, this.getHealth());
    }
}

module.exports = PlayerUnit;