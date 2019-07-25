const Unit = require("./unit");
import CharacterStats from "./../knightlands-shared/character_stat";

class PlayerUnit extends Unit {
    constructor(user) {
        let currentStats = {
            ...user._data.character.stats
        };
        currentStats.health = user.getTimerValue(CharacterStats.Health);

        super(currentStats, user._data.character.stats);

        this._user = user;
    }

    setHealth(value) {
        super.setHealth(value);
        this._user.setTimerValue(CharacterStats.Health, value);
    }
}

module.exports = PlayerUnit;