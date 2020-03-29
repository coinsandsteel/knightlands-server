import {
    DefaultStats
}
    from "./character_stat";

let EmptyStats = { ...DefaultStats };
for (let stat in EmptyStats) {
    EmptyStats[stat] = 0;
}

class Buffs {
    constructor() {
        this.bonusStats = {};
        this.finalStats = { ...DefaultStats };
    }

    calculate(now, rawStats, buffs, raidId) {
        this.bonusStats = { ...EmptyStats };

        let i = 0;
        const length = buffs.length;

        for (; i < length; ++i) {
            const buff = buffs[i];
            const timeElapsed = (now - buff.applyTime) / 1000;
            if (buff.duration < timeElapsed || (buff.raid && raidId != buff.raid)) {
                continue;
            }

            let value = buff.value;
            if (buff.relative) {
                value = rawStats[buff.stat] * buff.value / 100;
            }

            this.bonusStats[buff.stat] += value;
        }

        this.finalStats = { ...DefaultStats };
        for (let stat in this.bonusStats) {
            this.finalStats[stat] = this.bonusStats[stat] + rawStats[stat];
        }
    }
}

export default Buffs;