const RaidChallenge = require("./raidChallenge");

class TopDamageDealersChallenge extends RaidChallenge {
    constructor(topSpotsCount) {
        this._topSpotsCount = topSpotsCount;
        this._damageDealersTop = new TinyQueue(); // to sort by damage dealt
        this._damageDealers = {}; // damage dealers container
    }

    onHit(player, damageDealt) {
        let damageDealtEntry = this._damageDealers[player.id];

        if (!damageDealtEntry) {
            damageDealtEntry = {
                damageDone: 0,
                playerId: player.id
            };

            this._damageDealers[player.id] = damageDealtEntry;
            this._damageDealersTop.push(damageDealtEntry) - 1;
        }

        damageDealtEntry.damageDone += damageDealt;
    }

    finalize() {
        // sort descending 
        this._damageDealersTop.sort((a, b) => {
            return b.damageDone - a.damageDone;
        });
    }

    snapshot() {
        return this._damageDealersTop;
    }
}