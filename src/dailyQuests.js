const { Collections } = require("./database");
import Game from "./game";
import Errors from "./knightlands-shared/errors";
import DailyQuestType from "./knightlands-shared/daily_quest_type";
import Events from "./knightlands-shared/events";

class DailyQuests {
    constructor(data, user) {
        this._data = data;
        this._user = user;
    }

    static get TaskCompleted() {
        return "task_completed";
    }

    async init() {
        if (!this._data.hasOwnProperty("cycle")) {
            let defaultData = {
                cycle: 0,
                playerLevel: 0,
                taskProgress: {},
                completedTasks: {},
                claimedTasks: {}
            };

            for (let k in defaultData) {
                this._data[k] = defaultData[k];
            }
        }

        this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "dailyQuests" });
        this._checkCycle();
    }

    async onUnitSummoned(count, isAdvanced) {
        if (isAdvanced) {
            this._advanceTask(DailyQuestType.DailyAdvancedSummon, count);
        } else {
            this._advanceTask(DailyQuestType.DailyBasicSummon, count);
        }
    }

    async onChestOpened(count, isAdvanced) {
        if (isAdvanced) {
            this._advanceTask(DailyQuestType.DailyLegendaryChest, count);
        } else {
            this._advanceTask(DailyQuestType.DailySilverChest, count);
        }
    }

    async onUnitLevelUp(count, isTroop) {
        if (isTroop) {
            this._advanceTask(DailyQuestType.DailyLevelUpTroop, count);
        } else {
            this._advanceTask(DailyQuestType.DailyLevelUpGeneral, count);
        }
    }

    async onFreeRaidFinished() {
        this._advanceTask(DailyQuestType.DailyFreeRaid, 1);
    }

    async onPaidRaidJoin() {
        this._advanceTask(DailyQuestType.DailyPaidRaid, 1);
    }

    async onItemDisenchant(count = 1) {
        this._advanceTask(DailyQuestType.DailyDisenchant, count);
    }

    async onItemEnchanted(count = 1) {
        this._advanceTask(DailyQuestType.DailyEnchantItem, count);
    }

    async onItemLeveled(count = 1) {
        this._advanceTask(DailyQuestType.DailyLevelUpItem, count);
    }

    async onBeastBoosted(count = 1) {
        this._advanceTask(DailyQuestType.DailyBoostBeast, count);
    }

    async onGoldSpent(amount = 1) {
        this._advanceTask(DailyQuestType.DailySpendGold, amount);
    }

    async onArmourTrialsEngaged(count = 1) {
        this._advanceTask(DailyQuestType.DailyArmourTrial, count);
    }

    async onWeaponTrialsEngaged(count = 1) {
        this._advanceTask(DailyQuestType.DailyWeaponTrial, count);
    }

    async onAccessoryTrialsEngaged(count = 1) {
        this._advanceTask(DailyQuestType.DailyAccessoryTrial, count);
    }

    async onTowerComplete(count = 1) {
        this._advanceTask(DailyQuestType.DailyTower, count);
    }

    async onQuestEngaged(times = 1) {
        // this._advanceTask(DailyQuestType.DailyEngageQuest, times);
    }

    async onPremiumPurchase(count = 1) {
        // this._advanceTask(DailyQuestType.DailySpendPremium, count);
    }

    async onAdventureStarted() {
        this._advanceTask(DailyQuestType.DailyStartAdventure, 1);
    }

    async claimRewards(taskType) {
        if (this._data.claimedTasks[taskType]) {
            throw Errors.CantClaimReward;
        }

        let taskRewards;
        const meta = this._getCurrentLevelMeta();

        taskRewards = meta.rewards[taskType];

        if (!taskRewards) {
            throw Errors.UnknownTask;
        }

        let rewards = {
            soft: taskRewards.soft,
            hard: taskRewards.hard,
            exp: taskRewards.exp
        }

        const items = await Game.lootGenerator.getLootFromTable(taskRewards.loot)

        if (items.length > 0) {
            await this._user.inventory.addItemTemplates(items);
        }

        await this._user.addSoftCurrency(rewards.soft);
        await this._user.addHardCurrency(rewards.hard);
        await this._user.addExperience(rewards.exp);

        this._data.claimedTasks[taskType] = true;

        rewards.items = items;

        return rewards;
    }

    _checkCycle() {
        const rewardCycle = this._user.getDailyRewardCycle();

        if (this._data.cycle != rewardCycle) {
            this._data.cycle = rewardCycle;
            this._data.playerLevel = this._user.level;
            this._data.completedTasks = {};
            this._data.taskProgress = {};
            this._data.claimedTasks = {};
        }
    }

    _getCurrentLevelMeta() {
        let tasksMeta;
        for (let i = 0; i < this._meta.quests.length; ++i) {
            tasksMeta = this._meta.quests[i];
            if (tasksMeta.maximumLevel >= this._data.playerLevel) {
                break;
            }
        }

        return tasksMeta;
    }

    _countTowardsAllTasks() {
        this._advanceTask(DailyQuestType.DailyAllTasks, 1, false);
        this._advanceTask(DailyQuestType.DailyAllTasks2, 1, false);
        this._advanceTask(DailyQuestType.DailyAllTasks3, 1, false);
    }

    _advanceTask(taskType, count, countTowardsAll = true) {
        // do not count towards task that wasn't claim yet
        if (this._data.completedTasks[taskType]) {
            return;
        }

        const currentLevelMeta = this._getCurrentLevelMeta();
        const taskMeta = currentLevelMeta.rewards[taskType];

        let currentProgress = this._data.taskProgress[taskType] || 0;
        const maxProgress = taskMeta.targetValue;

        currentProgress += count;

        if (currentProgress >= maxProgress) {
            currentProgress = maxProgress;

            // complete task
            this._data.completedTasks[taskType] = true;
            this._data.taskProgress[DailyQuestType.DailyAllTasks] = (this._data.taskProgress[DailyQuestType.DailyAllTasks] || 0) + 1;

            if (countTowardsAll) {
                this._countTowardsAllTasks();
            }

            Game.emitPlayerEvent(this._user.address, Events.DailyTaskComplete, {
                type: taskType
            });
        }

        this._data.taskProgress[taskType] = currentProgress;
    }
}

module.exports = DailyQuests;
