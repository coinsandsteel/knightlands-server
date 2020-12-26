const RaidChallenge = require("./raidChallenge");
import RaidChallengeType from "../knightlands-shared/raid_challenge";
const Events = require("../knightlands-shared/events");

class TopDamageDealersChallenge extends RaidChallenge {
    constructor(meta, data, raidEventEmitter) {
        super();

        this._topSpotsCount = meta.param1;
        this._rewards = meta.rewards;
        this._damageDealersTop = [];// to sort by damage dealt
        this._damageDealers = {}; // damage dealers container

        if (raidEventEmitter) {
            raidEventEmitter.on(raidEventEmitter.Hit, this.onHit.bind(this));
        }

        if (data) {
            let i = 0;
            const length = data.length;
            for (; i < length; ++i) {
                let record = data[i];
                this._addNewEntry(record.by).damageDone = record.damageDone;
            }

            this.finalize();
        }
    }

    onHit(player, damageDealt) {
        let damageDealtEntry = this._damageDealers[player.id];

        if (!damageDealtEntry) {
            damageDealtEntry = this._addNewEntry(player.id);
        }

        damageDealtEntry.damageDone += damageDealt;
    }

    type() {
        return RaidChallengeType.TopDamageDealers;
    }

    _addNewEntry(id) {
        let damageDealtEntry = {
            damageDone: 0,
            by: id
        };

        this._damageDealers[id] = damageDealtEntry;
        this._damageDealersTop.push(damageDealtEntry);

        return damageDealtEntry;
    }

    finalize() {
        // sort descending 
        this._damageDealersTop.sort((a, b) => {
            return b.damageDone - a.damageDone;
        });

        if (this._damageDealersTop.length > this._topSpotsCount) {
            this._damageDealersTop.splice(this._topSpotsCount);
        }
    }

    getRewards(userId) {
        let rewards = {
            loot: null,
            dkt: 0,
            softCurrency: 0,
            hardCurrency: 0
        };

        let userRecordIndex = this._damageDealersTop.findIndex(x => x.by == userId);
        if (userRecordIndex !== -1) {
            userRecordIndex++;
            // min - max place ranges are 1 based
            let chosenReward;
            // determine reward
            let i = 0;
            const length = this._rewards.length;
            for (; i < length; ++i) {
                let rewardRecord = this._rewards[i];
                if (rewardRecord.param2 > rewardRecord.param1) {
                    // it is a range of positions
                    if (rewardRecord.param1 <= userRecordIndex && rewardRecord.param2 >= userRecordIndex) {
                        chosenReward = rewardRecord;
                        break;
                    }
                } else if (rewardRecord.param1 === userRecordIndex) {
                    // single position
                    chosenReward = rewardRecord;
                    break;
                }
            }

            if (chosenReward) {
                rewards.loot = chosenReward.loot;
                rewards.rolls = chosenReward.rolls;
                rewards.dkt = chosenReward.dkt;
                rewards.softCurrency = chosenReward.softCurrency;
                rewards.hardCurrency = chosenReward.hardCurrency;
            }
        }

        return rewards;
    }

    snapshot() {
        return this._damageDealersTop;
    }
}

module.exports = TopDamageDealersChallenge;
