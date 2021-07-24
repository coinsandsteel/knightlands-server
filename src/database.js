const ObjectUtils = require("./objectUtils");

// builds flat update query for mongodb from diff
// TODO support arrays
function _buildPaths(key, changes, paths = {}) {
    for (let i in changes) {
        if (typeof (changes[i]) == "object" && !Array.isArray(changes[i])) {
            let innerPath = _buildPaths(i, changes[i]);
            if (Object.keys(innerPath).length > 0) {
                for (let j in innerPath) {
                    paths[`${key}.${j}`] = innerPath[j];
                }
            } else {
                paths[`${key}.${i}`] = changes[i];
            }
        } else {
            paths[`${key}.${i}`] = changes[i];
        }
    }

    return paths;
}

module.exports = {
    ConnectionString: "mongodb://127.0.0.1:27017/knightlands",
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
        FreeRaidsClearance: "free_raids_clearance",
        RaidsMeta: "raids_meta",
        RaidsWeaknessRotations: "raid_weakness_rotations",
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
        PresaleData: "presale_data",
        GachaState: "gacha_state",
        Whitelist: "whitelist",
        DropZoneModifiers: "drop_zone_modifiers",
        Adventures: "adventures",
        AdventuresList: "adventures_list",
        TowerMeta: "tower_meta",
        DivTokenWithdrawals: "div_token_withdrawals",
        DivsWithdrawals: "divs_withdrawals",
        DivsWithdrawalRequests: "divs_withdrawal_requests",
        DivTokenState: "div_token_state",
        DivsPayouts: "divs_payouts",
        DivTokenFarmed: "div_token_farmed",
        DivTokenRateTimeseries: "div_token_rate_timeseries",
        Tournaments: "tournaments",
        TournamentTables: "tournaments_tables",
        Races: "races",
        RaceTables: "race_tables",
        RaceWinners: "race_winners",
        Leaderboards: "leaderboards",
        Armies: "armies",
        Seasons: "seasons",
        SeasonsSchedule: "seasons_schedule",
        DktMining: "dkt_mining",
        TokenWithdrawals: "token_withdrawals",
        TokenWithdrawalRequests: "token_withdrawal_requests",
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
