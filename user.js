const CharacterStats = require("./knightlands-shared/character_stat");
const Experience = require("./knightlands-shared/experience");
const uuidv4 = require('uuid/v4');
const cloneDeep = require('lodash.clonedeep');

const DefaultRegenTimeSeconds = 120;

const DefaultStats = {
    health: 100,
    attack: 5,
    criticalChance: 2,
    energy: 30,
    stamina: 5,
    honor: 1,
    luck: 0,
    defense: 0
};

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

    get id() {
        return this._data._id;
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
        let questProgress = this.getQuestProgress(questId);
        questProgress.hits += hits;
    }

    addSoftCurrency(value) {
        this._data.softCurrency += value;
    }

    // returns levels gained
    addExperience(exp) {
        let character = this._data.character;
        let levelBeforeExp = character.level;
        let maxLevel = 100;
        character.exp += exp * 1;
        while (maxLevel-- > 0) {
            let toNextLevel = Experience.getRequiredExperience(character.level);
            console.log("character.exp", character.exp, "character.level", character.level, "toNextLevel", toNextLevel);
            if (toNextLevel <= character.exp) {
                character.level++;
                character.exp -= toNextLevel;
                character.freeAttributePoints += 5;
                character.stats[CharacterStats.Honor] += 1;
                this.getTimer(CharacterStats.Energy).value = character.stats[CharacterStats.Energy];
                this.getTimer(CharacterStats.Stamina).value = character.stats[CharacterStats.Stamina];
            } else {
                break;
            }
        }

        return character.level - levelBeforeExp;
    }

    getTimer(stat) {
        return this._data.character.timers[stat];
    }

    getTimerValue(stat) {
        this._advanceTimer(stat);
        return this.getTimer(stat).value;
    }

    modifyTimerValue(stat, value) {
        this._advanceTimer(stat);
        this.getTimer(stat).value += value;
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

        if (character.stats[stat] <= timer.value) {
            timer.lastRegenTime = now;
            return;
        }

        let timePassed = now - timer.lastRegenTime;
        let valueRenerated = Math.floor(timePassed / DefaultRegenTimeSeconds);
        timer.value += valueRenerated;
        // clamp to max value
        timer.value = character.stats[stat] < timer.value ? character.stats[stat] : timer.value;
        // adjust regen time to accomodate rounding
        timer.lastRegenTime += valueRenerated * DefaultRegenTimeSeconds;
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
        this._originalData = cloneDeep(userData);

        this._advanceTimers();

        return this;
    }

    getQuestProgress(questId) {
        let progress = this._data.questsProgress[questId];
        if (!progress) {
            progress = {
                hits: 0
            };
            this._data.questsProgress[questId] = progress;
        }

        return progress;
    }

    applyStats(stats) {
        let totalPointsSpent = 0;
        for (let i in stats) {
            if (!Number.isInteger(stats[i])) {
                return `incorrect stat ${i}`;
            }

            if (!this._data.character.attributes.hasOwnProperty(i)) {
                return `incorrect stat ${i}`;;
            }

            totalPointsSpent += stats[i];
            this._data.character.attributes[i] += stats[i];
        }

        // if not enough points 
        if (totalPointsSpent > this._data.character.freeAttributePoints) {
            return "not enough attribute points";
        }

        this._data.character.freeAttributePoints -= totalPointsSpent;
        this._calculateFinalStats();

        return null;
    }

    _calculateFinalStats() {
        let finalStats = Object.assign({}, DefaultStats);
        for (let i in this._data.character.attributes) {
            finalStats[i] += this._data.character.attributes[i];
        }

        // apply items

        let oldStats = this._data.character.stats;
        this._data.character.stats = finalStats;

        // correct timers
        for (let i in this._data.character.timers) {
            let timer = this._data.character.timers[i];
            if (timer.value == oldStats[i]) {
                timer.value = finalStats[i];
            }
        }
    }

    resetStats() {
        for (let i in this._data.character.attributes) {
            this._data.character.freeAttributePoints += this._data.character.attributes[i];
            this._data.character.attributes[i] = 0;
        }

        this._calculateFinalStats();

        return null;
    }

    // iterate over original data and latest, compare and build diff object
    _detectChanges(oldObj, newObj, changes) {
        let fieldsDetected = false;
        for (let i in newObj) {
            if (i == "_id") {
                continue;
            }

            if (typeof (newObj[i]) == "object") {
                if (!oldObj.hasOwnProperty(i)) {
                    changes[i] = newObj[i];
                    fieldsDetected = true;
                } else {
                    let innerChanges = {};
                    if (this._detectChanges(oldObj[i], newObj[i], innerChanges)) {
                        fieldsDetected = true;
                        changes[i] = innerChanges;
                    }
                }
            } else {
                if (!oldObj.hasOwnProperty(i) || oldObj[i] !== newObj[i]) {
                    changes[i] = newObj[i];
                    fieldsDetected = true;
                }
            }
        }

        return fieldsDetected;
    }

    async commitChanges() {
        let changes = {};
        this._detectChanges(this._originalData, this._data, changes);

        let users = this._db.collection(Collections.Users);
        let query = {};
        this._buildUpdateQuery(changes, query);

        await users.updateOne({
            _id: this.id
        }, {
            $set: query
        });

        return changes;
    }

    // builds flat update query for mongodb from diff
    _buildPaths(key, changes, paths = {}) {
        for (let i in changes) {
            if (typeof (changes[i]) == "object") {
                let innerPath = this._buildPaths(i, changes[i]);
                for (let j in innerPath) {
                    paths[`${key}.${j}`] = innerPath[j];
                }
            } else {
                paths[`${key}.${i}`] = changes[i];
            }
        }

        return paths;
    }

    // create mongodb update query from diff object
    _buildUpdateQuery(changes, query) {
        for (let i in changes) {
            if (typeof (changes[i]) == "object") {
                let paths = this._buildPaths(i, changes[i]);
                for (let j in paths) {
                    query[j] = paths[j];
                }
            } else {
                query[i] = changes[i];
            }
        }
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
                stats: Object.assign({}, DefaultStats),
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
                equipment: {},
                freeAttributePoints: 0
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