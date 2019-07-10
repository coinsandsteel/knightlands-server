const CharacterStats = require("./knightlands-shared/character_stat");
const uuidv4 = require('uuid/v4');
const DefaultRegenTimeSeconds = 120;

const Collections = {
    Users: "users",
    Zones: "zones",
    Quests: "quests"
};

class User {
    constructor(address, db) {
        this._address = address;
        this._db = db;
    }

    serializeForClient() {
        // we can use shallow copy here, we delete only first level fields
        let data = Object.assign({}, this._data);

        // remove unwanted fields
        delete data._id;
        delete data.nonce;
        delete data.address;

        return data;
    }

    get nonce() {
        return this._data.nonce;
    }

    get exp() {
        return this._data.character.exp;
    }

    get level() {
        return this._data.character.level;
    }

    get softCurrency() {
        return this._data.softCurrency;
    }

    get address() {
        return this._address;
    }

    updateProgress(questId, hits) {
        this.getQuestProgress(questId).hits = hits;
    }

    // returns levels gained
    addExperience(exp) {
        let character = this._data.character;
        let levelBeforeExp = character.level;
        while (exp > 0) {
            let toNextLevel = 15 * character.level;
            if (toNextLevel <= exp) {
                character.level++;
                exp -= toNextLevel;
            }
        }

        return character.level - levelBeforeExp;
    }


    // TODO make a transactional way of modifying delta of the model
    async saveAfterQuest(questId) {
        let updateQuery = {
            $set: {
                "character.timers.energy.value": this.energy,
                "character.exp": this.exp,
                "softCurrency": this.softCurrency
            }
        };
        updateQuery.$set[`questProgress.${questId}`] = this.getQuestProgress(questId);

        let users = this._db.collection(Collections.Users);
        await users.updateOne({
            _id: this.id
        }, updateQuery);
    }

    getTimerValue(stat) {
        this._advanceTimer(stat);
        return this._data.character.timers[stat].value;
    }

    modifyTimerValue(stat, value) {
        this._advanceTimer(stat);
        this._data.character.timers[stat].value += value;
    }

    _advanceTimers() {
        for (let i in this._data.character.timers) {
            this._advanceTimer(i);
        }
    }

    _advanceTimer(stat) {
        let now = Math.floor(new Date().getTime() / 1000); // milliseconds to seconds
        let character = this._data.character;
        let timer = character.timers[stat];
        let timePassed = now - timer.lastRegenTime;
        let valueRenerated = Math.floor(timePassed / DefaultRegenTimeSeconds);
        timer.value += valueRenerated;
        // clamp to max value
        timer.value = character.stats[stat] < timer.value ? character.stats[stat] : timer.value;
        // adjust regen time to accomodate rounding
        timer.regenTime += valueRenerated * DefaultRegenTimeSeconds;
    }

    async generateNewNonce() {
        this._data.nonce = uuidv4();
        const users = this._db.collection(Collections.Users);
        await users.updateOne({
            address: this._address
        }, {
            $set: {
                nonce: this._data.nonce
            }
        });
    }

    async load() {
        const users = this._db.collection(Collections.Users);
        let userData = await users.findOne({
            address: this._address
        });

        if (!userData) {
            userData = this._validateUser({
                address: this._address,
                softCurrency: 0,
                dkt: 0,
                hardCurrency: 0
            });
            await users.insertOne(userData);
        } else {
            userData = this._validateUser(userData);
        }

        this._data = userData;

        this._advanceTimers();

        return this;
    }

    getQuestProgress(questId) {
        let progress = this._data.questsProgress[questId];
        if (!progress) {
            progress = {
                hits: 0
            };
        }
        return progress;
    }

    _validateUser(user) {
        if (!user.character) {
            let character = {
                level: 1,
                exp: 0,
                timers: {
                    health: {
                        value: 0,
                        lastRegenTime: 0,
                        regenTime: DefaultRegenTimeSeconds
                    },
                    energy: {
                        value: 0,
                        lastRegenTime: 0,
                        regenTime: DefaultRegenTimeSeconds
                    },
                    stamina: {
                        value: 0,
                        lastRegenTime: 0,
                        regenTime: DefaultRegenTimeSeconds
                    }
                },
                stats: {
                    health: 100,
                    attack: 5,
                    criticalChance: 2,
                    energy: 30,
                    stamina: 5,
                    honor: 1,
                    luck: 0,
                    defense: 0
                },
                attributes: {
                    health: 0,
                    attack: 0,
                    defense: 0,
                    luck: 0,
                    energy: 0,
                    stamina: 0
                },
                buffs: [],
                inventory: [],
                equipment: {}
            };

            user.character = character;
        }

        if (!user.questsProgress) {
            user.questsProgress = {

            };
        }

        return user;
    }
}

module.exports = User;