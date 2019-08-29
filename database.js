const ObjectUtils = require("./objectUtils");

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
        Giveaways: "giveaways",
        PresaleChests: "presale_chests",
        PresaleChestsLogs: "presale_chests_logs",
        GachaMeta: "gacha_meta",
        PresaleData: "presale_data"
    },


    // create mongodb update query from diff object
    // TODO support arrays
    buildUpdateQuery(oldData, newData) {
        let changes = {};
        let updateQuery = null;
        if (ObjectUtils.detectChanges(oldData, newData, changes)) {
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
        if (ObjectUtils.detectRemovals(oldData, newData, removals)) {
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