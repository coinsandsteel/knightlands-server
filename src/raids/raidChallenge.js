'use strict';

class RaidChallenge {
    constructor() { }

    onHit(player, damageDealt) { }

    finalize() { }

    snapshot() { }

    type() { }

    claimLoot(userId) {
        return {
            items: [],
            dkt: 0,
            softCurrency: 0,
            hardCurrency: 0
        }
    }
}

module.exports = RaidChallenge;