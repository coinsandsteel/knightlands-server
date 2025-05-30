import CharacterStat from "../knightlands-shared/character_stat";
import random from "../random";
import Random from "../random";

class Unit {
    constructor(stats, maxStats, level = 1) {
        this._level = level;
        this._stats = stats;
        this._maxStats = maxStats;
    }

    get maxStats() {
        return this._maxStats;
    }

    getAttack() {
        let attack = this.getStat(CharacterStat.Attack);
        const crit = this.isCritical();
        if (crit) {
            attack *= (1 + this.getStat(CharacterStat.CriticalDamage) / 100);
        }

        // roll damage 2 times, half attack, with 20% variation, for normal distribution
        const dmg1 = random.range(attack * 0.4, attack * 0.6);
        const dmg2 = random.range(attack * 0.4, attack * 0.6);

        return {
            attack: Math.floor(dmg1 + dmg2),
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
        this._stats[stat] = Math.min(value, this._maxStats[stat]);
    }

    isCritical() {
        return Random.range(1, 10000, true) <= this.getStat(CharacterStat.CriticalChance);
    }

    attackRaid(raidBoss, bonusDamage, flatDamage) {
        let { attack, crit } = this.getAttack();

        attack += this.getStat(CharacterStat.RaidDamage);
        if (Number.isInteger(flatDamage)) {
            attack += flatDamage;
        }
        attack *= bonusDamage;

        return { damage: raidBoss._applyDamage(attack), crit };
    }

    dodged(attacker) {
        // for now attacker is not used
        return random.range(0, 1, true) <= this.getStat(CharacterStat.Dodge);
    }

    attack(victim) {
        const result = {
            damage: 0,
            dodged: false,
            crit: false
        };

        if (victim.dodged(this)) {
            result.dodged = true;
        } else {
            let { attack, crit } = this.getAttack();

            result.damage = victim._applyDamage(attack);
            result.crit = crit;
        }

        return result;
    }

    _applyDamage(damage) {
        let defense = this.getStat(CharacterStat.Defense);
        if (defense === undefined) {
            defense = 0;
        }

        const baseDefense = 10 * this._level;
        let damageReduction = defense / (defense + baseDefense);
        let finalDamage = Math.floor(damage * (1 - damageReduction));

        let damageCap = this._maxStats.damageCap;
        if (damageCap) {
            finalDamage = finalDamage <= damageCap ? finalDamage : damageCap;
        }

        finalDamage = Math.ceil(finalDamage);

        this.modifyHealth(-finalDamage);

        return finalDamage;
    }
}

module.exports = Unit;