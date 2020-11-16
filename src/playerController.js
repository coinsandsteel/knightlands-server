'use strict';

import Random from "./random";
const Operations = require("./knightlands-shared/operations");
const Events = require("./knightlands-shared/events");
import Errors from "./knightlands-shared/errors";
import CurrencyType from "./knightlands-shared/currency_type";
import CharacterStats from "./knightlands-shared/character_stat";
const Unit = require("./combat/unit");
const FloorEnemyUnit = require("./combat/floorEnemyUnit");
const IPaymentListener = require("./payment/IPaymentListener");
const ItemActions = require("./knightlands-shared/item_actions");
const Inventory = require("./inventory");
import CharacterStat from "./knightlands-shared/character_stat";
const Config = require("./config");

const {
    Collections
} = require("./database");

import Game from "./game";

const TowerFloorPageSize = 20;

class PlayerController extends IPaymentListener {
    constructor(socket) {
        super();

        this._socket = socket;

        if (socket.authToken) {
            this.address = socket.authToken.address;
        }

        this._db = Game.db;
        this._raidManager = Game.raidManager;
        this._lootGenerator = Game.lootGenerator;
        this._signVerifier = Game.blockchain;
        this._opThrottles = {};

        // admin functions
        this._socket.on(Operations.GetQuestData, this._getQuestData.bind(this));

        // service functions
        this._socket.on(Operations.Auth, this._handleAuth.bind(this));
        this._socket.on(Operations.GetUserInfo, this._handleGetUserInfo.bind(this));
        this._socket.on(Operations.FetchRaidInfo, this._fetchRaid.bind(this));
        this._socket.on(Operations.FetchRaidSummonStatus, this._fetchRaidSummonStatus.bind(this));
        this._socket.on(Operations.FetchRaidJoinStatus, this._fetchRaidJoinStatus.bind(this));
        this._socket.on(Operations.FetchCraftingStatus, this._fetchCraftingStatus.bind(this));
        this._socket.on(Operations.GetCurrencyConversionRate, this._getCurrencyConversionRate.bind(this));
        this._socket.on(Operations.FetchRaidsList, this._fetchRaidsList.bind(this));
        this._socket.on(Operations.SyncTime, this._syncTime.bind(this));
        this._socket.on(Operations.FetchRefillTimerStatus, this._fetchRefillTimerStatus.bind(this));
        this._socket.on(Operations.GetTimerRefillInfo, this._getTimerRefillInfo.bind(this));
        this._socket.on(Operations.FetchChestOpenStatus, this._fetchChestOpenStatus.bind(this));
        this._socket.on(Operations.FetchEnchantingStatus, this._fetchEnchantingStatus.bind(this));

        // payed functions 
        this._socket.on(Operations.SendPayment, this._acceptPayment.bind(this));
        this._socket.on(Operations.CancelPayment, this._gameHandler(this._cancelPayment.bind(this)));

        // raids
        this._socket.on(Operations.SummonRaid, this._summonRaid.bind(this));
        this._socket.on(Operations.JoinRaid, this._joinRaid.bind(this));
        this._socket.on(Operations.AttackRaidBoss, this._gameHandler(this._attackRaidBoss.bind(this), "raid", Config.game.attackCooldown));
        this._socket.on(Operations.ClaimRaidLoot, this._gameHandler(this._claimLootRaid.bind(this)));
        this._socket.on(Operations.FetchRaidRewards, this._gameHandler(this._fetchRaidRewards.bind(this)));
        this._socket.on(Operations.FetchTokenRates, this._gameHandler(this._fetchTokenRates.bind(this)));

        // misc
        this._socket.on(Operations.ChangeClass, this._gameHandler(this._changeClass.bind(this)));
        this._socket.on(Operations.EngageQuest, this._gameHandler(this._engageQuest.bind(this), "quest", Config.game.attackCooldown));
        this._socket.on(Operations.UseItem, this._gameHandler(this._useItem.bind(this)));
        this._socket.on(Operations.OpenChest, this._gameHandler(this._openChest.bind(this)));
        this._socket.on(Operations.GetChestsStatus, this._gameHandler(this._getChestsStatus.bind(this)));
        this._socket.on(Operations.ResetZone, this._gameHandler(this._resetZone.bind(this)));
        this._socket.on(Operations.EquipItem, this._gameHandler(this._equipItem.bind(this)));
        this._socket.on(Operations.UnequipItem, this._gameHandler(this._unequipItem.bind(this)));
        this._socket.on(Operations.BuyStat, this._gameHandler(this._buyStat.bind(this)));
        this._socket.on(Operations.RefillTimer, this._gameHandler(this._refillTimer.bind(this)));

        // Crafting
        this._socket.on(Operations.UpgradeItem, this._gameHandler(this._levelUpItem.bind(this)));
        this._socket.on(Operations.UnbindItem, this._gameHandler(this._unbindItem.bind(this)));
        this._socket.on(Operations.CraftItem, this._gameHandler(this._craftItem.bind(this)));
        this._socket.on(Operations.EnchantItem, this._gameHandler(this._enchantItem.bind(this)));
        this._socket.on(Operations.DisenchantItems, this._gameHandler(this._disenchantItems.bind(this)));
        this._socket.on(Operations.DisenchantConvert, this._gameHandler(this._disenchantConvert.bind(this)));
        this._socket.on(Operations.CreateWeapon, this._gameHandler(this._createWeapon.bind(this)));
        this._socket.on(Operations.Evolve, this._gameHandler(this._evolveItem.bind(this)));
        this._socket.on(Operations.CraftAccessory, this._gameHandler(this._craftAccessory.bind(this)));
        this._socket.on(Operations.RerollAccessory, this._gameHandler(this._rerollAccessory.bind(this)));
        this._socket.on(Operations.CancelRerollAccessory, this._gameHandler(this._cancelRerollAccessory.bind(this)));

        // Adventures
        this._socket.on(Operations.BuyAdventureSlot, this._gameHandler(this._buyAdventureSlot.bind(this)));
        this._socket.on(Operations.FetchAdventuresStatus, this._gameHandler(this._fetchAdventuresStatus.bind(this)));
        this._socket.on(Operations.StartAdventure, this._gameHandler(this._startAdventure.bind(this)));
        this._socket.on(Operations.ClaimAdventure, this._gameHandler(this._claimAdventure.bind(this)));
        this._socket.on(Operations.RefreshAdventures, this._gameHandler(this._refreshAdventures.bind(this)));

        // Daily rewards
        this._socket.on(Operations.FetchDailyRewardStatus, this._gameHandler(this._fetchDailyRewardStatus.bind(this)));
        this._socket.on(Operations.CollectDailyReward, this._gameHandler(this._collectDailyReward.bind(this)));
        this._socket.on(Operations.FetchDailyRefillsStatus, this._gameHandler(this._fetchDailyRefillsStatus.bind(this)));
        this._socket.on(Operations.CollectDailyRefills, this._gameHandler(this._collectDailyRefills.bind(this)));

        // Beast taming
        this._socket.on(Operations.BeastRegularBoost, this._gameHandler(this._beastRegularBoost.bind(this)));
        this._socket.on(Operations.BeastAdvancedBoost, this._gameHandler(this._beastAdvancedBoost.bind(this)));
        this._socket.on(Operations.EvolveBeast, this._gameHandler(this._evolveBeast.bind(this)));
        this._socket.on(Operations.FetchBeastBoostPurchase, this._gameHandler(this._fetchBeastBoostPurchase.bind(this)));

        // Tower 
        this._socket.on(Operations.FetchTowerFloors, this._gameHandler(this._fetchTowerFloors.bind(this)));
        this._socket.on(Operations.ChallengeTowerFloor, this._gameHandler(this._challengeTowerFloor.bind(this)));
        this._socket.on(Operations.AttackTowerFloor, this._gameHandler(this._attackTowerFloor.bind(this), "tower", Config.game.attackCooldown));
        this._socket.on(Operations.SkipTowerFloor, this._gameHandler(this._skipTowerFloor.bind(this)));
        this._socket.on(Operations.ClaimTowerFloorRewards, this._gameHandler(this._claimTowerFloorRewards.bind(this)));
        this._socket.on(Operations.CancelTowerFloor, this._gameHandler(this._cancelTowerFloor.bind(this)));
        this._socket.on(Operations.FetchChallengedTowerFloor, this._gameHandler(this._fetchChallengedTowerFloor.bind(this)));
        this._socket.on(Operations.PurchaseTowerAttempts, this._gameHandler(this._purchaseTowerAttempts.bind(this)));
        this._socket.on(Operations.FetchTowerAttemptsStatus, this._gameHandler(this._fetchTowerAttemptsStatus.bind(this)));

        // Trials
        this._socket.on(Operations.FetchTrialState, this._gameHandler(this._fetchTrialState.bind(this)));
        this._socket.on(Operations.ChallengeTrialFight, this._gameHandler(this._challengeTrialFight.bind(this)));
        this._socket.on(Operations.CollectTrialStageReward, this._gameHandler(this._collectTrialStageReward.bind(this)));
        this._socket.on(Operations.FetchTrialFightMeta, this._gameHandler(this._fetchTrialFightMeta.bind(this)));
        this._socket.on(Operations.AttackTrial, this._gameHandler(this._attackTrial.bind(this), "trial", Config.game.attackCooldown));
        this._socket.on(Operations.ChooseTrialCard, this._gameHandler(this._chooseTrialCard.bind(this)));
        this._socket.on(Operations.ImproveTrialCard, this._gameHandler(this._improveTrialCard.bind(this)));
        this._socket.on(Operations.ResetTrialCards, this._gameHandler(this._resetTrialCards.bind(this)));
        this._socket.on(Operations.SummonTrialCards, this._gameHandler(this._summonTrialCards.bind(this)));
        this._socket.on(Operations.PurchaseTrialAttempts, this._gameHandler(this._purchaseTrialAttempts.bind(this)));
        this._socket.on(Operations.FetchTrialAttemptsStatus, this._gameHandler(this._fetchTrialAttemptsStatus.bind(this)));

        // Gold exchange
        this._socket.on(Operations.BoostGoldExchange, this._gameHandler(this._boostGoldExchange.bind(this)));
        this._socket.on(Operations.PremiumBoostGoldExchange, this._gameHandler(this._premiumBoostGoldExchange.bind(this)));
        this._socket.on(Operations.ObtainGoldFromGoldExchange, this._gameHandler(this._obtainGoldFromGoldExchange.bind(this)));
        this._socket.on(Operations.GetGoldExchangeMeta, this._gameHandler(this._getGoldExchangeMeta.bind(this)));
        this._socket.on(Operations.FetchGoldExchangePremiumBoostStatus, this._gameHandler(this._fetchGoldExchangePremiumStatus.bind(this)));

        // Daily quests
        this._socket.on(Operations.ClaimDailyTasksRewards, this._gameHandler(this._claimDailyTasksRewards.bind(this)));

        // Dividends
        this._socket.on(Operations.WithdrawDividendToken, this._gameHandler(this._withdrawDividendToken.bind(this)));
        this._socket.on(Operations.FetchPendingDividendTokenWithdrawal, this._gameHandler(this._fetchPendingDividenTokenWithdrawal.bind(this)));
        this._socket.on(Operations.SendDividendTokenWithdrawal, this._gameHandler(this._sendDividendTokenWithdrawal.bind(this)));

        // Tournaments
        this._socket.on(Operations.FetchTournaments, this._gameHandler(this._fetchTournaments.bind(this)));
        this._socket.on(Operations.JoinTournament, this._gameHandler(this._joinTournament.bind(this)));
        this._socket.on(Operations.ClaimTournamentRewards, this._gameHandler(this._claimTournamentRewards.bind(this)));
        this._socket.on(Operations.FetchTournamentRankings, this._gameHandler(this._fetchTournamentRankings.bind(this)));
        this._socket.on(Operations.GetTournamentInfo, this._gameHandler(this._getTournamentInfo.bind(this)));
        this._socket.on(Operations.GetFinishedTournaments, this._gameHandler(this._getFinishedTournaments.bind(this)));
        this._socket.on(Operations.GetTournamentRewards, this._gameHandler(this._getTournamentRewards.bind(this)));

        // Races
        this._socket.on(Operations.FetchRaces, this._gameHandler(this._fetchRaces.bind(this)));
        this._socket.on(Operations.JoinRace, this._gameHandler(this._joinRace.bind(this)));
        this._socket.on(Operations.GetRaceInfo, this._gameHandler(this._getRaceInfo.bind(this)));
        this._socket.on(Operations.GetRaceRewards, this._gameHandler(this._getRaceRewards.bind(this)));
        this._socket.on(Operations.ClaimRaceRewards, this._gameHandler(this._claimRaceRewards.bind(this)));
        this._socket.on(Operations.FetchRaceRankings, this._gameHandler(this._fetchRaceRankings.bind(this)));
        this._socket.on(Operations.GetFinishedRaces, this._gameHandler(this._getFinishedRaces.bind(this)));
        this._socket.on(Operations.GetRaceShop, this._gameHandler(this._getRaceShop.bind(this)));
        this._socket.on(Operations.PurchaseRaceShop, this._gameHandler(this._purchaseFromRaceShop.bind(this)));

        // Leaderboards
        this._socket.on(Operations.GetLeaderboardRankings, this._gameHandler(this._getLeaderboardRankings.bind(this)));
        this._socket.on(Operations.GetLeaderboardRank, this._gameHandler(this._getLeaderboardRank.bind(this)));

        // Army
        this._socket.on(Operations.GetArmy, this._gameHandler(this._getArmy.bind(this)));
        this._socket.on(Operations.SetLegionSlot, this._gameHandler(this._setLegionSlot.bind(this)));
        this._socket.on(Operations.SummonArmyUnit, this._gameHandler(this._summonArmyUnit.bind(this)));
        this._socket.on(Operations.GetArmySummonInfo, this._gameHandler(this._summonArmyInfo.bind(this)));
        this._socket.on(Operations.FetchArmySummonStatus, this._gameHandler(this._fetchSummonArmyUnitPaymentStatus.bind(this)));
        this._socket.on(Operations.LevelUpArmyUnit, this._gameHandler(this._levelUpArmyUnit.bind(this)));
        this._socket.on(Operations.UnitEquipItem, this._gameHandler(this._unitEquipItem.bind(this)));
        this._socket.on(Operations.UnitUnequipItem, this._gameHandler(this._unitUnequipItem.bind(this)));
        this._socket.on(Operations.UnitPromo, this._gameHandler(this._unitPromotion.bind(this)));
        this._socket.on(Operations.UnitAbilityTransfer, this._gameHandler(this._unitTransferAbility.bind(this)));
        this._socket.on(Operations.UnitBanishment, this._gameHandler(this._unitBanish.bind(this)));
        this._socket.on(Operations.UnitReserve, this._gameHandler(this._unitReserve.bind(this)));

        // Gold mines
        this._socket.on(Operations.UpgradeMine, this._gameHandler(this._upgradeMine.bind(this)));
        this._socket.on(Operations.UpgradeMineStorage, this._gameHandler(this._upgradeMineStorage.bind(this)));
        this._socket.on(Operations.ExpandMine, this._gameHandler(this._expandMine.bind(this)));
        this._socket.on(Operations.CollectMine, this._gameHandler(this._collectMine.bind(this)));

        // Inventory
        this._socket.on(Operations.LockItem, this._gameHandler(this._lockItem.bind(this)));
        this._socket.on(Operations.UnlockItem, this._gameHandler(this._unlockItem.bind(this)));
        
        this._handleEventBind = this._handleEvent.bind(this);
    }

    get socket() {
        return this._socket;
    }

    onDisconnect() {
        Game.removeListener(this.address, this._handleEventBind);
        console.log(`player ${this.address} is disconnected`);
        if (this._user) {
            this._user.dispose();
        }
        
        this.address = null;
    }

    onAuthenticated() {
        Game.on(this.address, this._handleEventBind);
        console.log(`${this.address} listeners ${Game.listeners(this.address).length}`)
    }

    async onPayment(iap, eventToTrigger, context) {
        console.log("on payment succeed", JSON.stringify({ iap, eventToTrigger, context }, null, 2));
        this._socket.emit(eventToTrigger, {
            iap,
            context
        });
    }

    async onDividendTokenWithdrawal(success) {
        let dkt = this._user.dkt;
        console.log("on div token withdrawal", JSON.stringify({ success, dkt: dkt }, null, 2));
        this._socket.emit(Events.DivTokenWithdrawal, {
            success
        });
    }

    async onPaymentFailed(iap, eventToTrigger, reason, context) {
        console.log("on payment failed", JSON.stringify({ iap, eventToTrigger, reason, context }, null, 2));
        this._socket.emit(eventToTrigger, {
            iap,
            reason,
            context
        });
    }

    _syncTime(_, respond) {
        respond(null, {
            time: new Date().getTime()
        });
    }

    async _handleAuth(data, respond) {
        if (this._socket.authToken) {
            respond("authenticated");
            return;
        }

        if (!data.address) {
            respond("address is required");
            return;
        }

        let user = await this.getUser(data.address);

        // if no signed message - generate new nonce and return it back to client
        if (!data.message) {
            let nonce = await user.generateNonce();
            respond(null, nonce);
        } else {
            // if signed message is presented - verify message
            try {
                let result = await this._signVerifier.verifySign(user.nonce, data.message, user.address);
                if (result) {
                    this.address = user.address;

                    this._socket.setAuthToken({
                        address: user.address,
                        nonce: user.nonce
                    });

                    respond(null, "success");
                } else {
                    throw "verification failed";
                }
            } catch (exc) {
                console.log(exc);
                respond("access denied");
            }
        }
    }

    async _handleEvent(event, args) {
        switch (event) {
            case Inventory.Changed:
                this._socket.emit(Events.InventoryUpdate, args);

                const user = await this.getUser();
                await user.onInventoryChanged();
                break;

            default:
                this._socket.emit(event, args);
        }
    }

    async _handleGetUserInfo(data, respond) {
        let user = await this.getUser(this.address);
        let response = user.serializeForClient();
        await user.loadInventory();
        response.inventory = user.inventory.info;
        respond(null, response);
    }

    async getUser(address) {
        if (!this._user) {
            this._user = await Game.loadUser(address || this.address);
        }

        return this._user;
    }

    async _getCurrencyConversionRate(_, respond) {
        respond(null, {
            rate: Game.currencyConversionService.conversionRate
        });
    }

    async _getQuestData(_, respond) {
        let zones = await this._db.collection(Collections.Zones).find({}).toArray();
        respond(null, zones);
    }

    _gameHandler(handler, throttleId = "default", throttle = 0) {
        return async (data, respond) => {
            if (throttle > 0) {
                if (this._opThrottles[throttleId] >= Game.now) {
                    respond("throttle");
                    return;
                } else {
                    this._opThrottles[throttleId] = Game.now + throttle;
                }
            }

            let user = await this.getUser(this.address);

            try {
                let response = await handler(user, data);
                let changes = await user.commitChanges();

                respond(null, { changes, response });
            } catch (error) {
                console.log(error);
                respond(error);
            }
        }
    }

    async _engageQuest(user, data) {
        if (!Number.isInteger(data.stage)) {
            throw "missing zone stage";
        }

        if (!Number.isInteger(data.zone)) {
            throw "missing zone";
        }

        if (!Number.isInteger(data.questIndex)) {
            throw "missin quest index";
        }

        const zones = this._db.collection(Collections.Zones);
        let zone = await zones.findOne({
            _id: data.zone
        });

        if (!zone) {
            throw "incorrect zone";
        }

        if (zone.quests.length <= data.questIndex) {
            throw "incorrect quest";
        }

        // quests exists?
        let quest = zone.quests[data.questIndex];
        if (!quest) {
            throw "incorrect quest";
        }

        let isBoss = quest.boss;
        quest = quest.stages[data.stage];

        if (!quest) {
            throw "incorrect stage";
        }

        // check if previous zone was completed on the same stage
        let previousZone = await zones.findOne({
            _id: data.zone - 1
        });

        if (previousZone && !user.isZoneCompleted(previousZone._id, data.stage)) {
            throw "complete previous zone";
        }

        if (data.stage > 0) {
            // check if previous zones finished
            let totalZones = await zones.find({}).count();
            if (!user.isZoneCompleted(totalZones, data.stage - 1)) {
                throw "complete previous difficulty";
            }
        }

        let itemsToDrop = 0;
        let questComplete = false;
        let damages = [];
        let engages = 0;

        if (isBoss) {
            let bossProgress = user.getQuestBossProgress(zone._id, data.stage);

            if (!bossProgress.unlocked) {
                throw Errors.BossIsLocked;
            }

            if (!user.enoughHp) {
                throw "not enough health";
            }

            let bossData = quest;

            let unitStats = {};
            unitStats[CharacterStats.Health] = bossData.health - bossProgress.damageRecieved;
            unitStats[CharacterStats.Attack] = bossData.attack;
            unitStats[CharacterStats.Defense] = bossData.defense;
            let bossUnit = new Unit(unitStats, bossData);

            if (!bossUnit.isAlive) {
                throw Errors.BossDead;
            }

            let playerUnit = user.getCombatUnit();

            while (user.enoughHp && bossUnit.isAlive) {
                engages++;
                // exp and gold are calculated based on damage inflicted
                let attackResult = playerUnit.attack(bossUnit);
                damages.push(attackResult);

                bossUnit.attack(playerUnit);

                bossProgress.exp += bossData.exp * (attackResult.damage / bossUnit.getMaxHealth());
                let expGained = Math.floor(bossProgress.exp);
                bossProgress.exp -= expGained;
                await user.addExperience(expGained);

                bossProgress.gold += Random.range(bossData.goldMin, bossData.goldMax) * (attackResult.damage / bossUnit.getMaxHealth());
                let softCurrencyGained = Math.floor(bossProgress.gold);
                bossProgress.gold -= softCurrencyGained;
                await user.addSoftCurrency(softCurrencyGained);

                // if just 1 hit 
                if (data.max !== true) {
                    break;
                }
            }

            // override to save in database
            bossProgress.damageRecieved = bossUnit.getMaxHealth() - bossUnit.getHealth();
            if (bossProgress.damageRecieved > bossUnit.getMaxHealth()) {
                bossProgress.damageRecieved = bossUnit.getMaxHealth();
            }

            if (!bossUnit.isAlive) {
                user.setZoneCompletedFirstTime(data.zone, data.stage);
                questComplete = true;
            }
        } else {
            // get saved progress or create default
            let questProgress = user.getQuestProgress(data.zone, data.questIndex, data.stage);
            if (!questProgress) {
                throw "not allowed to engage";
            }

            // quest is still not complete?
            if (questProgress.hits >= quest.hits) {
                throw "quest is finished";
            }

            // calculate hits
            let hits = 1;
            if (data.max) {
                hits = quest.hits - questProgress.hits;
            }

            let energyLeft = user.getTimerValue(CharacterStats.Energy);
            // make sure user has enough energy
            if (quest.energy > energyLeft) {
                throw "not enough energy";
            }

            let energyRequired = hits * quest.energy;
            // if user asks for more than 1 hit and doesn't have enough energy - let him perform as many hits as energy allows
            if (energyLeft < energyRequired) {
                hits = Math.floor(energyLeft / quest.energy);
                energyRequired = hits * quest.energy;
            }

            questProgress.hits += hits;
            itemsToDrop = hits;

            await user.modifyTimerValue(CharacterStats.Energy, -energyRequired);

            let softCurrencyGained = 0;

            while (hits-- > 0) {
                engages++;
                await user.addExperience(quest.exp);
                softCurrencyGained += Math.floor(Random.range(quest.goldMin, quest.goldMax));
            }

            await user.addSoftCurrency(softCurrencyGained);

            // will reset if current quest is not complete 
            questComplete = true;

            // check if all previous quests are finished
            let allQuestsFinished = true;
            for (let index = 0; index < zone.quests.length; index++) {
                const quest = zone.quests[index];
                let otherQuestProgress = user.getQuestProgress(data.zone, index, data.stage);
                if (!otherQuestProgress || otherQuestProgress.hits < quest.stages[data.stage].hits) {
                    allQuestsFinished = false;
                    if (index == data.questIndex) {
                        questComplete = false;
                    }
                    break;
                }
            }

            if (allQuestsFinished) {
                // unlock final boss
                let bossProgress = user.getQuestBossProgress(data.zone, data.stage);
                bossProgress.unlocked = true;
            }
        }

        let items = await this._lootGenerator.getQuestLoot(
            this.address,
            data.zone,
            data.questIndex,
            isBoss,
            data.stage,
            itemsToDrop,
            questComplete,
            user.getMaxStatValue(CharacterStat.Luck)
        );

        if (items) {
            await user.addLoot(items);
        }

        if (engages > 0) {
            await user.dailyQuests.onQuestEngaged(engages);
        }

        return { damages, items };
    }

    async _buyStat(user, data) {
        await user.trainStats(data);
    }

    async _equipItem(user, data) {
        await user.equipItem(data.itemId);
    }

    async _unequipItem(user, data) {
        await user.unequipItem(data.slot);
    }

    async _useItem(user, data) {
        let count = data.count * 1;
        if (!Number.isInteger(count)) {
            count = 1;
        }

        return await user.useItem(data.itemId, count);
    }

    async _getChestsStatus(user, data) {
        return user.getChests();
    }

    async _openChest(user, data) {
        const { chest, iap, count } = data;

        // each chest has corresponding item attached to it to open
        let gachaMeta = await this._db.collection(Collections.GachaMeta).findOne({ name: chest });
        if (!gachaMeta) {
            throw Errors.UnknownChest;
        }

        if (iap && gachaMeta.iaps[iap]) {
            return await Game.lootGenerator.requestChestOpening(this.address, gachaMeta, iap);
        } else {
            let freeOpening = false;
            // check if this is free opening
            if (gachaMeta.freeOpens > 0) {
                let chests = user.getChests();
                let cycleLength = 86400000 / gachaMeta.freeOpens; // 24h is base cycle

                if (!chests[chest] || Game.now - chests[chest] >= cycleLength) {
                    user.setChestFreeOpening(chest);
                    freeOpening = true;
                }
            }

            let chestsToOpen = count || 1;

            // check if key item is required
            if (!freeOpening && gachaMeta.itemKey) {
                let itemKey = user.inventory.getItemByTemplate(gachaMeta.itemKey);
                if (!itemKey) {
                    throw Errors.NoChestKey;
                }

                if (chestsToOpen > itemKey.count) {
                    chestsToOpen = itemKey.count;
                }

                // consume key
                user.inventory.removeItem(itemKey.id, chestsToOpen);
            }

            return await Game.lootGenerator.openChest(user, chest, chestsToOpen);
        }
    }

    async _resetZone(user, data) {
        if (!Number.isInteger(data.stage)) {
            throw Errors.IncorrectArguments;
        }

        if (!Number.isInteger(data.zone)) {
            throw Errors.IncorrectArguments;
        }

        let zones = this._db.collection(Collections.Zones);
        let zone = await zones.findOne({
            _id: data.zone
        });

        if (!zone) {
            throw Errors.IncorrectArguments;
        }

        if (!user.resetZoneProgress(zone, data.stage)) {
            throw "already reset";
        }

        return null;
    }

    async _refillTimer(user, data) {
        // data.stat - type of the timer to refill
        // data.refillType 
        //     0 - Native currency
        //     1 - Shinies
        //     2 - Items
        // In case of items we also need data.items - array of itemIds to use and count

        let {
            stat,
            refillType,
            items
        } = data;

        if (!stat && !refillType) {
            throw Errors.IncorrectArguments;
        }

        if (!Number.isInteger(refillType)) {
            throw Errors.IncorrectArguments;
        }

        let timer = user.getTimer(stat);
        if (!timer) {
            throw Errors.IncorrectArguments;
        }

        if (refillType == 2) {
            // items. Check if those items can be used as timer refill
            let templateIds = [];
            for (let i in items) {
                templateIds.push(i * 1);
            }

            const templates = await Game.itemTemplates.getTemplates(templateIds);
            let i = 0;
            const length = templates.length;
            for (; i < length; ++i) {
                const template = templates[i];
                const item = user.inventory.getItemById(items[template._id].id);
                if (!item) {
                    throw Errors.IncorrectArguments;
                }

                if (!template.action || template.action.action != ItemActions.RefillTimer || template.action.stat != stat) {
                    throw Errors.IncorrectArguments;
                }
            }

            user.refillTimerWithItems(stat, items, templates);
        } else {
            if (refillType == 0 && stat != CharacterStats.Health) {
                return await Game.userPremiumService.requestRefillPayment(this.address, stat);
            }

            let refillCost = await user.getTimerRefillCost(stat);
            if (refillCost.hard > 0) {
                if (refillCost.hard > user.hardCurrency) {
                    throw Errors.NotEnoughCurrency;
                }

                await user.addHardCurrency(-refillCost.hard);
            } else if (refillCost.soft > 0) {
                if (refillCost.soft > user.softCurrency) {
                    throw Errors.NotEnoughCurrency;
                }

                await user.addSoftCurrency(-refillCost.soft);
            }

            user.refillTimer(stat);
        }

        return null;
    }

    async _getTimerRefillInfo(data, respond) {
        let user = await this.getUser();
        let timeRefillCost = await user.getTimerRefillCost(data.stat);
        timeRefillCost.refills = user.getRefillsCount(data.stat);
        timeRefillCost.timeTillReset = user.getTimeUntilReset(data.stat);
        respond(null, timeRefillCost);
    }

    async _fetchRefillTimerStatus(data, respond) {
        let timeRefillInfo = await Game.userPremiumService.getTimerRefillStatus(this.address, data.stat);
        respond(null, timeRefillInfo);
    }

    async _acceptPayment(data, respond) {
        try {
            await Game.paymentProcessor.acceptPayment(this.address, data.paymentId, data.signedTransaction);
            respond(null);
        } catch (exc) {
            respond(exc);
        }
    }

    // Raids
    async _fetchRaidJoinStatus(data, respond) {
        let joinStatus = await this._raidManager.getJoinStatus(this.address, data.raidId);
        respond(null, joinStatus);
    }

    async _fetchRaidSummonStatus(data, respond) {
        let summonStatus = await this._raidManager.getSummonStatus(this.address, data.raid);
        respond(null, summonStatus);
    }

    async _fetchRaid(data, respond) {
        let raidInfo = await this._raidManager.getRaidInfo(this.address, data.raidId);
        respond(null, raidInfo);
    }

    async _fetchRaidsList(_, respond) {
        let raids = await this._raidManager.getCurrentRaids(this.address);
        respond(null, raids);
    }

    async _summonRaid(data, respond) {
        let user = await this.getUser(this.address);

        try {
            let payment = await this._raidManager.summonRaid(user, data.raid, data.free);
            respond(null, payment);
        } catch (exc) {
            console.log(exc);
            respond(exc);
        }
    }

    async _joinRaid(data, respond) {
        const { isFree } = data;
        if (isFree) {
            respond(null, await this._raidManager.joinFreeRaid(this.address, data.raidId))
            return
        }

        try {
            let payment = await this._raidManager.joinRaid(this.address, data.raidId);
            respond(null, payment);
        } catch (exc) {
            console.log(exc);
            respond(exc);
        }
    }

    async _attackRaidBoss(user, data) {
        data.hits *= 1;

        if (!Number.isInteger(data.hits)) {
            throw Errors.IncorrectArguments;
        }

        let raid = this._raidManager.getRaid(data.raidId);
        if (!raid) {
            throw Errors.InvalidRaid;
        }

        await raid.attack(user, parseInt(data.hits), parseInt(data.legionIndex));

        return null;
    }

    async _fetchRaidRewards(user, data) {
        return await this._raidManager.getLootPreview(user, data.raidId);
    }

    async _fetchTokenRates(user, data) {
        let { from, to, raid } = data;

        from = parseInt(from);
        to = parseInt(to);
        raid = parseInt(raid);

        if (isNaN(from) || isNaN(to) || isNaN(raid)) {
            throw Errors.IncorrectArguments;
        }

        return await this._raidManager.tokenRates.query(raid, from, to);
    }

    async _claimLootRaid(user, data) {
        let rewards = await this._raidManager.claimLoot(user, data.raidId);

        if (!rewards) {
            throw Errors.NoRewards;
        }

        await user.addSoftCurrency(rewards.gold);
        await user.addExperience(rewards.exp);
        await user.inventory.addItemTemplates(rewards.items);
        await user.addDkt(rewards.dkt);
        await user.addHardCurrency(rewards.hardCurrency);

        await Game.tokenAmounts.insertTokens(rewards.dkt);

        return rewards;
    }

    // crafting
    // if item never have been modified server will return new item id for created unique version
    async _levelUpItem(user, data) {
        const { materials, itemId, count } = data;

        let leveledItemId = await user.levelUpItem(itemId, materials, count);

        return leveledItemId;
    }

    async _unbindItem(user, data) {
        const { itemId, items } = data;

        let unbindItemId = await user.unbindItem(itemId, items);

        return unbindItemId;
    }

    async _craftItem(user, data) {
        let { recipeId, currency, amount } = data;

        recipeId = parseInt(recipeId);
        amount = parseInt(amount);
        
        if (amount < 1) {
            throw Errors.IncorrectArguments;
        }

        let unknownCurrency = true;
        for (const key in CurrencyType) {
            if (CurrencyType[key] === currency) {
                unknownCurrency = false;
                break;
            }
        }

        if (unknownCurrency) {
            throw Errors.IncorrectArguments;
        }

        return await user.crafting.craftRecipe(recipeId, currency, amount);
    }

    async _enchantItem(user, data) {
        const { itemId, currency } = data;

        let unknownCurrency = true;
        for (const key in CurrencyType) {
            if (CurrencyType[key] === currency) {
                unknownCurrency = false;
                break;
            }
        }

        if (unknownCurrency) {
            throw Errors.IncorrectArguments;
        }

        return await user.enchantItem(itemId, currency);
    }

    async _disenchantItems(user, data) {
        return await user.crafting.disenchantItems(data.items);
    }

    async _disenchantConvert(user, data) {
        return await user.crafting.disenchantConvert(data.conversions);
    }

    async _fetchCraftingStatus(data, respond) {
        let status = await Game.craftingQueue.getCraftingStatus(this.address, data.recipeId);
        respond(null, status);
    }

    async _fetchChestOpenStatus(data, respond) {
        let gachaMeta = await this._db.collection(Collections.GachaMeta).findOne({ name: data.chest });
        if (!gachaMeta) {
            throw Errors.UnknownChest;
        }

        // find first status 
        for (let i in gachaMeta.iaps) {
            let status = await Game.lootGenerator.getChestOpenStatus(this.address, gachaMeta, i);
            if (status) {
                respond(null, status);
                return;
            }
        }

        respond(null, null);
    }

    async _fetchEnchantingStatus(data, respond) {
        let status = await Game.craftingQueue.getEnchantingStatus(this.address, data.itemId);
        respond(null, status);
    }

    async _createWeapon(user, data) {
        const { recipeId, currency, itemId, element } = data;
        return await user.crafting.createWeapon(recipeId, currency, itemId, element);
    }

    async _evolveItem(user, data) {
        const { itemId } = data;
        return await user.crafting.evolve(itemId);
    }

    async _craftAccessory(user, data) {
        return await user.crafting.createAccessory(+data.template, +data.count);
    }

    async _rerollAccessory(user, data) {
        return await user.crafting.rerollAccessory(+data.itemId);
    }

    async _cancelRerollAccessory(user, data) {
        return await user.crafting.rollbackRerollAccessory(+data.itemId);
    }

    // Adventures
    async _buyAdventureSlot(user, data) {
        return user.buyAdventureSlot();
    }

    async _fetchAdventuresStatus(user, data) {
        return await user.getAdventuresStatus();
    }

    async _startAdventure(user, data) {
        return await user.startAdventure(data.slot * 1, data.adventureIndex * 1);
    }

    async _claimAdventure(user, data) {
        return await user.claimAdventure(data.slot * 1);
    }

    async _refreshAdventures(user, data) {
        return await user.refreshAdventure(data.slot * 1);
    }

    // Classes
    async _changeClass(user, data) {
        return await user.selectClass(data.class);
    }

    // Daily rewards
    async _fetchDailyRewardStatus(user) {
        return await user.getDailyRewardStatus();
    }

    async _collectDailyReward(user) {
        return await user.collectDailyReward();
    }

    async _fetchDailyRefillsStatus(user) {
        return await user.getDailyRefillsStatus();
    }

    async _collectDailyRefills(user) {
        return await user.collectDailyRefills();
    }

    // Beast boosting
    async _beastRegularBoost(user, data) {
        return await user.beastBoost(data.count * 1, true);
    }

    async _beastAdvancedBoost(user, data) {
        if (data.hasOwnProperty("iapIndex")) {
            return await Game.userPremiumService.requestBeatSoulPurchase(this.address, data.iapIndex * 1);
        }

        return await user.beastBoost(data.count * 1, false);
    }

    async _evolveBeast(user) {
        return await user.evolveBeast();
    }

    async _fetchBeastBoostPurchase(user) {
        return await Game.userPremiumService.getBeastBoostPurchaseStatus(this.address);
    }

    async _cancelPayment(user, data) {
        return await Game.paymentProcessor.cancelPayment(this.address, data.id);
    }

    // Tower
    async _fetchTowerFloors(user, data) {
        let page = data.page * 1;

        if (!Number.isInteger(page) || page < -1) {
            throw Errors.IncorrectArguments;
        }

        // if page == -1 fetch list around last cleared floor
        const floorsCleared = user.towerFloorsCleared;

        if (page == -1) {
            page = Math.floor(floorsCleared / TowerFloorPageSize);
        }

        const startIndex = page * TowerFloorPageSize;
        const toSkip = (page + 1) * TowerFloorPageSize;

        // _id is an index of the floor, let's take advantage of it
        const floors = await this._db.collection(Collections.TowerMeta).find({ _id: { $lt: toSkip, $gte: startIndex } }).sort({ _id: -1 }).toArray();

        return {
            floors,
            floorsCleared,
            page
        };
    }

    async _challengeTowerFloor(user, data) {
        const floorIndex = data.floor * 1;

        if (!Number.isInteger(floorIndex) || floorIndex < 0 || floorIndex > user.towerFloorsCleared) {
            throw Errors.IncorrectArguments;
        }

        const towerFloor = user.challengedTowerFloor;
        // check if challenge is finished
        if (towerFloor.userHealth > 0 && !towerFloor.claimed && towerFloor.health <= 0) {
            throw Errors.TowerFloorInProcess;
        }

        const floorData = await this._db.collection(Collections.TowerMeta).find({
            _id: {
                $in: [
                    floorIndex, "misc"
                ]
            }
        }).toArray();

        const floorMeta = floorData.find(x => x._id != "misc");
        if (!floorMeta) {
            throw Errors.IncorrectArguments;
        }

        if (user.freeTowerAttempts <= 0) {
            const miscMeta = floorData.find(x => x._id == "misc");
            const ticketItem = user.inventory.getItemByTemplate(miscMeta.ticketItem);
            if (!ticketItem) {
                throw Errors.TowerNoTicket;
            }
        }

        towerFloor.startTime = Game.now;
        towerFloor.health = floorMeta.health;
        towerFloor.maxHealth = floorMeta.health;
        towerFloor.attack = floorMeta.attack;
        towerFloor.id = floorIndex;
        towerFloor.userHealth = user.getMaxStatValue(CharacterStat.Health);
        towerFloor.userMaxHealth = user.getMaxStatValue(CharacterStat.Health);
        towerFloor.claimed = false;

        return towerFloor;
    }

    async _attackTowerFloor(user) {
        const towerFloor = user.challengedTowerFloor;
        // check if challenge is timed out or unclaimed and finished
        if (towerFloor.userHealth <= 0 || towerFloor.health <= 0) {
            throw Errors.TowerFloorFinished;
        }

        const userUnit = user.getTowerFloorCombatUnit();
        const floorEnemyUnit = new FloorEnemyUnit(towerFloor.attack, towerFloor.health);

        const attackResult = userUnit.attack(floorEnemyUnit);
        if (floorEnemyUnit.isAlive) {
            floorEnemyUnit.attack(userUnit);
        }

        towerFloor.health = floorEnemyUnit.getHealth();
        towerFloor.userHealth = userUnit.getHealth();

        return {
            ...attackResult,
            enemyHealth: towerFloor.health,
            playerHealth: towerFloor.userHealth
        };
    }

    async _skipTowerFloor(user, data) {
        const floor = data.floor * 1;
        // only skip cleared floors
        if (user.towerFloorsCleared <= floor) {
            throw Errors.IncorrectArguments;
        }

        // check if there is a skip item
        const towerMiscMeta = await this._db.collection(Collections.TowerMeta).findOne({ _id: "misc" });
        const skipItem = user.inventory.getItemByTemplate(towerMiscMeta.skipItem);
        if (!skipItem) {
            throw Errors.NoEnoughItems;
        }

        user.inventory.removeItem(skipItem.id, 1);

        return await this._sendRewardsForTowerFloor(floor, false);
    }

    async _claimTowerFloorRewards(user) {
        // only unclaimed and finished floor
        const towerFloor = user.challengedTowerFloor;
        if (towerFloor.health > 0) {
            throw Errors.TowerFloorInProcess;
        }

        if (towerFloor.claimed) {
            throw Errors.TowerFloorClaimed;
        }

        // is it a newly finished floor?
        const firstClearance = towerFloor.id == user.towerFloorsCleared;
        if (firstClearance) {
            user.towerFloorsCleared++;
        }

        towerFloor.claimed = true;
        
        if (user.freeTowerAttempts > 0) {
            user.freeTowerAttempts--;
        } else {
            const miscMeta = floorData.find(x => x._id == "misc");
            const ticketItem = user.inventory.getItemByTemplate(miscMeta.ticketItem);
            if (!ticketItem) {
                throw Errors.TowerNoTicket;
            }

            user.inventory.removeItem(ticketItem.id, 1);
        }

        return await this._sendRewardsForTowerFloor(towerFloor.id, firstClearance);
    }

    async _sendRewardsForTowerFloor(floor, firstClearance) {
        const floorMeta = await this._db.collection(Collections.TowerMeta).findOne({ _id: floor });
        const loot = firstClearance ? floorMeta.firstClearReward : floorMeta.repeatClearReward;

        const items = await Game.lootGenerator.getLootFromTable(loot);

        await this._user.addSoftCurrency(floorMeta.softCurrency);
        await this._user.addExperience(floorMeta.exp);
        await this._user.inventory.addItemTemplates(items);
        await this._user.dailyQuests.onTowerComplete(1);

        return {
            items,
            soft: floorMeta.softCurrency,
            exp: floorMeta.exp
        }
    }

    async _cancelTowerFloor(user) {
        const towerFloor = user.challengedTowerFloor;
        towerFloor.health = 0;
        towerFloor.claimed = true;
    }

    async _fetchChallengedTowerFloor(user) {
        const towerFloor = user.challengedTowerFloor;
        if (towerFloor.userHealth > 0 && (!towerFloor.claimed || towerFloor.health > 0)) {
            return towerFloor;
        }

        return null;
    }

    async _purchaseTowerAttempts(user, data) {
        return await Game.userPremiumService.requestTowerAttemptsPurchase(this.address, data.iapIndex * 1);
    }

    async _fetchTowerAttemptsStatus(user) {
        return await Game.userPremiumService.getTowerAttemptsPurchaseStatus(this.address);
    }

    // Trials
    async _fetchTrialState(user, data) {
        return user.getTrialState(data.trialType, data.trialId);
    }

    async _challengeTrialFight(user, data) {
        return user.challengeTrial(data.trialType, data.trialId, data.stageId, data.fightIndex);
    }

    async _collectTrialStageReward(user, data) {
        return await user.collectTrialStageReward(data.trialType, data.trialId, data.stageId);
    }

    async _fetchTrialFightMeta(user, data) {
        return user.fetchTrialFightMeta(data.trialType, data.trialId, data.stageId, data.fightIndex);
    }

    async _attackTrial(user, data) {
        return await user.attackTrial(data.trialType);
    }

    async _chooseTrialCard(user, data) {
        return await user.chooseTrialCard(data.trialType, data.cardIndex * 1);
    }

    async _improveTrialCard(user, data) {
        await user.improveTrialCard(data.cardEffect);
    }

    async _resetTrialCards(user) {
        await user.resetTrialCards();
    }

    async _summonTrialCards(user, data) {
        return await user.summonTrialCards(data.trialType);
    }

    async _fetchTrialAttemptsStatus(user, data) {
        const status = await Game.userPremiumService.getTrialAttemptsPurchaseStatus(this.address, data.trialType);
        return status;
    }

    async _purchaseTrialAttempts(user, data) {
        const status = await Game.userPremiumService.requestTrialAttemptsPurchase(this.address, data.trialType, data.iapIndex * 1);
        return status;
    }

    // Gold Exchange
    async _boostGoldExchange(user, data) {
        return user.goldExchange.freeBoost();
    }

    async _premiumBoostGoldExchange(user, data) {
        return await Game.userPremiumService.requireGoldExchangeBoost(this.address, data.count * 1);
    }

    async _obtainGoldFromGoldExchange(user, data) {
        return await user.goldExchange.obtainGold();
    }

    async _getGoldExchangeMeta(user) {
        return user.goldExchange.levelMeta;
    }

    async _fetchGoldExchangePremiumStatus() {
        return await Game.userPremiumService.getGoldExchangePremiumStatus(this.address);
    }

    // Daily Quests
    async _claimDailyTasksRewards(user, data) {
        return await user.dailyQuests.claimRewards(data.taskType);
    }

    // Dividends

    async _withdrawDividendToken(user, data) {
        return await Game.dividends.requestTokenWithdrawal(user, data.amount);
    }

    async _fetchPendingDividenTokenWithdrawal(user) {
        return await Game.dividends.getPendingWithdrawal(user.address);
    }

    async _sendDividendTokenWithdrawal(user, data) {
        return await Game.dividends.acceptTransaction(user.address, data.tx);
    }

    // Tournaments
    async _fetchTournaments(user, data) {
        return await Game.rankings.tournaments.getTournamentsInfo(user.address);
    }

    async _joinTournament(user, data) {
        return await Game.rankings.tournaments.join(user.address, data.tournamentId);
    }

    async _claimTournamentRewards(user, data) {
        let rewards = await Game.rankings.tournaments.claimRewards(user.address, data.tournamentId);
        if (!rewards) {
            throw Errors.NoRewards;
        }

        await user.inventory.addItemTemplates(rewards);
        await user.addDkt(rewards.tokens);

        return rewards;
    }

    async _fetchTournamentRankings(user, data) {
        return await Game.rankings.tournaments.getRankings(data.tournamentId, parseInt(data.page));
    }

    async _getTournamentInfo(user, data) {        
        return await Game.rankings.tournaments.getRank(data.tournamentId, user.address);
    }

    async _getFinishedTournaments(user, data) {
        return await Game.rankings.tournaments.getFinishedTournaments(user.address);
    }

    async _getTournamentRewards(user, data) {
        return await Game.rankings.tournaments.getRewards(data.tournamentId);
    }

    // Races
    async _fetchRaces(user, data) {
        return await Game.rankings.races.getRacesInfo(user.address);
    }

    async _joinRace(user, data) {
        return await Game.rankings.races.join(user.address, data.raceId);
    }

    async _claimRaceRewards(user, data) {
        let rewards = await Game.rankings.races.claimRewards(user.address, data.raceId);
        if (!rewards) {
            throw Errors.NoRewards;
        }

        await user.inventory.addItemTemplates(rewards);

        return rewards;
    }

    async _getRaceInfo(user, data) {        
        return await Game.rankings.races.getRank(data.raceId, user.address);
    }

    async _fetchRaceRankings(user, data) {
        return await Game.rankings.races.getRankings(data.raceId, parseInt(data.page));
    }

    async _getFinishedRaces(user, data) {
        return await Game.rankings.races.getFinishedRaces(user.address);
    }

    async _getRaceRewards(user, data) {
        return await Game.rankings.races.getRewards(data.raceId);
    }

    async _getRaceShop() {
        return await Game.rankings.races.getShop();
    }

    async _purchaseFromRaceShop(user, data) {
        return await Game.rankings.races.purchaseFromRaceShop(user, data.lotId);
    }

    // Leaderboards
    async _getLeaderboardRankings(user, data) {
        return await Game.rankings.leaderboards.getRankings(parseInt(data.type), parseInt(data.page));
    }

    async _getLeaderboardRank(user, data) {
        return await Game.rankings.leaderboards.getUserRank(parseInt(data.type), user.address);
    }

    // Armies
    async _getArmy(user, data) {
        return await Game.armyManager.getArmy(user.address);
    }

    async _setLegionSlot(user, data) {
        await Game.armyManager.setLegionSlot(user.address, user.level, data.legionIndex, data.slotId, data.unitId);
    }

    async _summonArmyUnit(user, data) {
        const { iap, count, summonType } = data;

        if (iap) {
            return await Game.armyManager.requestSummon(user.address, iap, summonType);
        } 

        return await Game.armyManager.summontUnits(user.address, count, summonType);
    }

    async _fetchSummonArmyUnitPaymentStatus(user) {
        return await Game.armyManager.getSummonStatus(user.address);
    }

    async _summonArmyInfo(user, data) {
        return await Game.armyManager.getSummonOverview(user.address);
    }

    async _levelUpArmyUnit(user, data) {
        return await Game.armyManager.levelUp(user.address, data.unitId);
    }

    async _unitEquipItem(user, data)  {
        return await Game.armyManager.equipItem(user.address, data.unitId, data.itemId);
    }

    async _unitUnequipItem(user, data) {
        return await Game.armyManager.unequipItem(user.address, data.unitId, data.slotId);
    }

    async _unitPromotion(user, data) {
        return await Game.armyManager.promote(user.address, data.unitId, data.units);
    }

    async _unitBanish(user, data) {
        return await Game.armyManager.banish(user.address, data.units);
    }

    async _unitReserve(user, data) {
        return await Game.armyManager.sendToReserve(user.address, data.units);
    }

    async _unitTransferAbility(user, data) {

    }

    // Gold mines
    async _upgradeMine(user, data) {
        return user.goldMines.upgradeMine(+data.mineIndex);
    }

    async _upgradeMineStorage(user) {
        return user.goldMines.upgradeStorage();
    }

    async _expandMine(user) {
        return user.goldMines.expand();
    }

    async _collectMine(user) {
        return user.goldMines.collectGold();
    }
    
    // Inventory
    async _lockItem(user, data) {
        await user.inventory.lockItem(+data.item);
    }

    async _unlockItem(user, data) {
        await user.inventory.unlockItem(+data.item);
    }
}

module.exports = PlayerController;
