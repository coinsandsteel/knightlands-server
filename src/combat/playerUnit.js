const Unit = require("./unit");
import CharacterStats from "../knightlands-shared/character_stat";

class PlayerUnit extends Unit {
    constructor(user, stats, maxStats) {
        let currentStats = {
            ...stats
        };
        currentStats.health = user.getTimerValue(CharacterStats.Health);

        super(currentStats, maxStats, user.level);

        this._user = user;
    }

    setHealth(value) {
        super.setHealth(value);
        this._user.setTimerValue(CharacterStats.Health, this.getHealth());
    }

    restoreStamina(value) {
        this.setStat(CharacterStats.Stamina, this.getStat(CharacterStats.Stamina) + value);
        this._user.setTimerValue(CharacterStats.Stamina, this.getStat(CharacterStats.Stamina));
    }

    restoreEnergy(value) {
        this.setStat(CharacterStats.Energy, this.getStat(CharacterStats.Energy) + value);
        this._user.setTimerValue(CharacterStats.Energy, this.getStat(CharacterStats.Energy));
    }

    restoreHealth(value) {
        this.setStat(CharacterStats.Health, this.getStat(CharacterStats.Health) + value);
        this._user.setTimerValue(CharacterStats.Health, this.getStat(CharacterStats.Health));
    }
}

module.exports = PlayerUnit;
