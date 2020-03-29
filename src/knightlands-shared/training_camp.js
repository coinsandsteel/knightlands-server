import UpgradableStats from "./upgradable_character_stats";

export default {
    getStatCost(stat, level) {
        return 500 + 250 * level;
    },

    getStatResourceCost(stat, level) {
        level += 1;

        switch (stat) {
            case UpgradableStats.Health:
                return Math.ceil(Math.pow(level, 0.68) * 1.1);
            case UpgradableStats.Attack:
                return Math.ceil(Math.pow(level, 0.75) * 1.1);
            case UpgradableStats.Luck:
                return Math.ceil(Math.pow(level, 0.6) * 1.1);
            case UpgradableStats.Energy:
                return Math.ceil(Math.pow(level, 0.83) * 1.1);
            case UpgradableStats.Stamina:
                return Math.ceil(Math.pow(level, 0.9) * 1.1);
        }
    },

    getMaxStat(characterLevel) {
        return characterLevel * 5;
    }
}