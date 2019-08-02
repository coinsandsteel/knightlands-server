import CharacterStat from "./../knightlands-shared/character_stat";

class Unit {
    constructor(stats, maxStats) {
        this._stats = stats;
        this._maxStats = maxStats;
    }

    // returns {min, max}
    getAttack() {
        return this.getStat(CharacterStat.Attack);
    }

    getHealth() {
        return this.getStat(CharacterStat.Health);
    }

    getMaxHealth() {
        return this._maxStats[CharacterStat.Health];
    }

    setHealth(value) {
        if (value < 0) {
            value = 0;
        }
        this.setStat(CharacterStat.Health, value);
    }

    modifyHealth(value) {
        this.setHealth(this.getHealth() + value);
    }

    get isAlive() {
        return this.getHealth() > 0;
    }

    getStat(stat) {
        return this._stats[stat];
    }

    setStat(stat, value) {
        this._stats[stat] = value;
    }

    attack(victim) {
        let attack = this.getAttack();

        // modify from defense
        let victimDefense = victim.getStat(CharacterStat.Defense);
        if (victimDefense === undefined) {
            victimDefense = 0;
        }

        let damageReduction = victimDefense / (victimDefense + 150);
        let finalAttack = Math.floor(attack * (1 - damageReduction));
        victim.modifyHealth(-finalAttack);

        return attack;
    }
}

module.exports = Unit;