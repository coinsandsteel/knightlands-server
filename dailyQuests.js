const { Collections } = require("./database");
import Game from "./game";
import Errors from "./knightlands-shared/errors";
import Random from "./random";
const Rarity = require("./knightlands-shared/rarity");
import DailyQuestType from "./knightlands-shared/daily_quest_type";

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
                freeRefreshes: 0,
                currentTask: null,
                points: 0,
                completedTasks: {},
                claimedPoints: 0,
                completedTasksCount: 0,
                doubleRewards: false
            };

            for (let k in defaultData) {
                this._data[k] = defaultData[k];
            }
        }

        this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "dailyQuests" });
        this._checkCycle();
    }

    async onItemEnchanted(count = 1) {
        await this._advanceTask(DailyQuestType.DailyEnchantItem, count);
    }

    async onItemLeveled(count = 1) {
        await this._advanceTask(DailyQuestType.DailyLevelUpItem, count);
    }

    async onBeastBoosted(count = 1) {
        await this._advanceTask(DailyQuestType.DailyBoostBeast, count);
    }

    async onGoldSpent(amount = 1) {
        await this._advanceTask(DailyQuestType.DailySpendGold, amount);
    }

    async onArmourTrialsEngaged(count = 1) {
        await this._advanceTask(DailyQuestType.DailyArmourTrial, count);
    }

    async onWeaponTrialsEngaged(count = 1) {
        await this._advanceTask(DailyQuestType.DailyWeaponTrial, count);
    }

    async onAccessoryTrialsEngaged(count = 1) {
        await this._advanceTask(DailyQuestType.DailyAccessoryTrial, count);
    }

    async onTowerAttacked(count = 1) {
        await this._advanceTask(DailyQuestType.DailyTower, count);
    }

    async onQuestEngaged(times = 1) {
        await this._advanceTask(DailyQuestType.DailyWeaponTrial, times);
    }

    async onPremiumPurchase(count = 1) {
        await this._advanceTask(DailyQuestType.DailySpendPremium, count);
    }

    async claimRewards() {
        const items = [];
        for (let index = 0; index < this._data.rewards.length; index++) {
            const rewardRecord = this._data.rewards[index];
            if (rewardRecord.pointsRequired > this._data.claimedPoints && rewardRecord.pointsRequired <= this._data.points) {
                this._data.claimedPoints = rewardRecord.pointsRequired;

                const rolledItem = Game.lootGenerator.rollLootRecord(rewardRecord.loot);
                if (this._data.doubleRewards) {
                    rolledItem.quantity *= 2;
                }

                items.push(rolledItem);                
            }
        }

        if (items.length > 0) {
            await this._user.inventory.addItemTemplates(items);
        }

        return items;
    }

    cancelTask() {
        this._data.currentTask = null;
    }

    acceptTask(taskIndex) {
        if (this._data.completedTasks[taskIndex] || this._data.completedTasksCount >= this._meta.maxQuestsToComplete) {
            throw Errors.DailyQuestsTaskCompleted;
        }

        if (taskIndex < 0 || taskIndex >= this._data.tasks.length) {
            throw Errors.IncorrectArguments;
        }

        const taskSettings = this._data.tasks[taskIndex];

        this._data.currentTask = {
            index: taskIndex,
            progress: 0,
            maxProgress: taskSettings.value,
            type: taskSettings.type,
            rarity: taskSettings.rarity
        };
    }

    refreshTasks(force = false) {
        if (!force) {
            let notAllowed = false;
            if (this._data.currentTask) {
                notAllowed = true;
            } else if (this._data.freeRefreshes > 0) {
                this._data.freeRefreshes--;
            } else {
                const item = this._user.inventory.getItemByTemplate(this._meta.refreshItem);
                if (item) {
                    this._user.inventory.removeItem(item);
                } else {
                    notAllowed = true;
                }
            }

            if (notAllowed) {
                throw Errors.DailyQuestsCantRefresh;
            }
        }

        const tasks = new Array(this._meta.questsToGenerate);
        // randomly pick N quest task ids with replacement
        const questIds = Random.sampleWeighted(this._meta.questWeights, this._meta.questsToGenerate);
        const rarityRules = Random.sampleWeighted(this._meta.rarityRules, this._meta.questsToGenerate);
        // allow mythical only be rolled once, if it wasn't completed before
        // randomly grab rarity for each task
        for (let i = 0; i < questIds.length; ++i) {
            const questTask = questIds[i].id;
            let rarityRuleSet = rarityRules[i];

            // only 1 mythical rarity allowed - replace it with legendary
            while (rarityRuleSet.rarity == Rarity.Mythical && this._data.doubleRewards) {
                rarityRuleSet = Random.sampleWeighted(this._meta.rarityRules, 1)[0];
            }

            if (rarityRuleSet.rarity == Rarity.Mythical) {
                this._data.doubleRewards = true;
            }

            const actionSettings = this._meta.actions[questTask];

            const task = {
                type: questTask,
                rarity: rarityRuleSet.rarity,
                value: actionSettings.value * rarityRuleSet.actionsToComplete
            };
            tasks[i] = task;
        }

        this._data.tasks = tasks;
    }

    _checkCycle() {
        const rewardCycle = this._user.getDailyRewardCycle();

        if (this._data.cycle != rewardCycle) {
            this._data.cycle = rewardCycle;
            this._data.freeRefreshes += this._meta.freeRefreshes;
            this._data.points = 0;
            this._data.claimedPoints = 0;
            this._data.completedTasksCount = 0;
            this._data.completedTasks = {};
            this._data.currentTask = null;
            this._data.doubleRewards = false;

            // lock rewards for the player at the start of the day
            for (let index = 0; index < this._meta.rewards.length; index++) {
                const record = this._meta.rewards[index];
                this._data.rewards = record.rewards;

                if (record.maximumLevel < this._user.level) {
                    break;
                }
            }

            this.refreshTasks(true);
        }
    }

    async _advanceTask(taskType, count) {
        if (!this._data.currentTask) {
            return;
        }

        const currentTask = this._data.currentTask;

        if (currentTask.type != taskType) {
            return;
        }

        if (currentTask.progress >= currentTask.maxProgress) {
            return;
        }

        currentTask.progress += count;

        if (currentTask.progress >= currentTask.maxProgress) {
            currentTask.progress = currentTask.maxProgress;
            // complete task
            const rarityRulesSet = this._meta.rarityRules.find(x => x.rarity == currentTask.rarity);

            this._data.completedTasks[currentTask.index] = true;
            this._data.points += rarityRulesSet.points;
            await this._user.addSoftCurrency(rarityRulesSet.soft);
            await this._user.addExperience(rarityRulesSet.exp);

            this._data.completedTasksCount++;

            if (rarityRulesSet.rarity == Rarity.Mythical) {
                this._data.doubleRewards = true;
            }

            // Game.emitPlayerEvent(this._user.address, DailyQuests.TaskCompleted, {
            //     type: currentTask.type
            // });
        }
    }
}

module.exports = DailyQuests;