import CharacterStat from "./../knightlands-shared/character_stat";
import Random from "../random";

class Unit {
    constructor(stats, maxStats) {
        this._stats = stats;
        this._maxStats = maxStats;
    }

    // returns {min, max}
    getAttack(raid) {
        let attack = this.getStat(CharacterStat.Attack) + (raid ? this.getStat(CharacterStat.RaidDamage) : 0);

        const crit = this.isCritical();
        if (crit) {
            attack *= (1 + this.getStat(CharacterStat.CriticalDamage) / 100);
        }

        return {
            attack,
            crit
        }
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

    isCritical() {
        return Random.range(0, 100, true) <= this.getStat(CharacterStat.CriticalChance);
    }

    attackRaid(raidBoss, bonusDamage) {
        let {attack, crit} = this.getAttack();

        attack *= bonusDamage;
        
        return { damage: raidBoss._applyDamage(attack), crit };
    }

    attack(victim) {
        let {attack, crit} = this.getAttack();

        return {
            damage: victim._applyDamage(attack),
            crit
        }
    }

    _applyDamage(damage) {
        let defense = this.getStat(CharacterStat.Defense);
        if (defense === undefined) {
            defense = 0;
        }

        let damageReduction = defense / (defense  + 150);
        let finalDamage = Math.floor(damage * (1 - damageReduction));

        let damageCap = this._maxStats.damageCap;
        if (damageCap) {
            damage = finalDamage <= damageCap ? finalDamage : damageCap;
        }

        finalDamage = Math.ceil(finalDamage);

        this.modifyHealth(-finalDamage);

        return finalDamage;
    }
}

module.exports = Unit;