// iterate over original data and current, compare and build diff object

const _ = require("lodash");

function _intersectionObjects2(a, b, areEqualFunction) {
    var results = [];

    for (var i = 0; i < a.length; i++) {
        var aElement = a[i];
        var existsInB = _.any(b, bElement => {
            return areEqualFunction(bElement, aElement);
        });

        if (existsInB) {
            results.push(aElement);
        }
    }

    return results;
}

function _intersection() {
    var results = arguments[0];
    var lastArgument = arguments[arguments.length - 1];
    var arrayCount = arguments.length;
    var areEqualFunction = _.isEqual;

    if (typeof lastArgument === "function") {
        areEqualFunction = lastArgument;
        arrayCount--;
    }

    for (var i = 1; i < arrayCount; i++) {
        var array = arguments[i];
        results = _intersectionObjects2(results, array, areEqualFunction);
        if (results.length === 0) break;
    }

    return results;
}

function _detectRemovals(oldObj, newObj, changes) {
    let fieldsDetected = false;

    // detect removed fields
    for (let i in oldObj) {
        if (i == "_id") {
            continue;
        }

        if (typeof (oldObj[i]) == "object") {
            if (!newObj.hasOwnProperty(i)) {
                changes[i] = "";
                fieldsDetected = true;
            } else {
                let innerChanges = {};
                if (_detectRemovals(oldObj[i], newObj[i], innerChanges)) {
                    fieldsDetected = true;
                    changes[i] = innerChanges;
                }
            }
        } else {
            if (!newObj || !newObj.hasOwnProperty(i)) {
                changes[i] = "";
                fieldsDetected = true;
            }
        }
    }

    return fieldsDetected;
}

// TODO support arrays
function _detectChanges(oldObj, newObj, changes) {
    let fieldsDetected = false;

    //detect new fields
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
                if (_detectChanges(oldObj[i], newObj[i], innerChanges)) {
                    fieldsDetected = true;
                    changes[i] = innerChanges;
                }
            }
        } else {
            if (!oldObj || !oldObj.hasOwnProperty(i) || oldObj[i] !== newObj[i]) {
                changes[i] = newObj[i];
                fieldsDetected = true;
            }
        }
    }

    return fieldsDetected;
}

// builds flat update query for mongodb from diff
// TODO support arrays
function _buildPaths(key, changes, paths = {}) {
    for (let i in changes) {
        if (typeof (changes[i]) == "object") {
            let innerPath = _buildPaths(i, changes[i]);
            for (let j in innerPath) {
                paths[`${key}.${j}`] = innerPath[j];
            }
        } else {
            paths[`${key}.${i}`] = changes[i];
        }
    }

    return paths;
}

module.exports = {
    ConnectionString: "mongodb://localhost:27017/knightlands",
    Collections: {
        Users: "users",
        Zones: "zones",
        Quests: "quests",
        QuestLoot: "quest_loot",
        ExpTable: "experience_table",
        Items: "items",
        Inventory: "inventory",
        Meta: "meta",
        Raids: "raids",
        RaidsMeta: "raids_meta",
        RaidsDktFactors: "raids_dkt_factors",
        RaidsDktMeta: "raids_dkt_meta",
        BlockchainEvents: "blockchain_events",
        PaymentRequests: "payment_requests",
        CraftingRecipes: "crafting_recipes",
        IAPs: "iaps",
        Services: "services",
        PaymentErrors: "payment_errors",
        GiveawayInventory: "giveaway_inventory",
        LinkedAccounts: "linked_accounts",
        GiveawayLogs: "giveaway_logs",
        Giveaways: "giveaways"
    },


    // create mongodb update query from diff object
    // TODO support arrays
    buildUpdateQuery(oldData, newData) {
        let changes = {};
        let updateQuery = null;
        if (_detectChanges(oldData, newData, changes)) {
            updateQuery = {};
            for (let i in changes) {
                if (typeof (changes[i]) == "object") {
                    let paths = _buildPaths(i, changes[i]);
                    for (let j in paths) {
                        updateQuery[j] = paths[j];
                    }
                } else {
                    updateQuery[i] = changes[i];
                }
            }
        }

        let removals = {};
        let removeQuery = null;
        if (_detectRemovals(oldData, newData, removals)) {
            removeQuery = {};
            for (let i in removals) {
                if (typeof (removals[i]) == "object") {
                    let paths = _buildPaths(i, removals[i]);
                    for (let j in paths) {
                        removeQuery[j] = paths[j];
                    }
                } else {
                    removeQuery[i] = removals[i];
                }
            }
        }

        return {
            updateQuery,
            removeQuery,
            changes,
            removals
        };
    }
}