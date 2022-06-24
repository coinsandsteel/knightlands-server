'use strict';

import Random from "./random";
const Operations = require("./knightlands-shared/operations");
const Events = require("./knightlands-shared/events");
import Errors from "./knightlands-shared/errors";
import CurrencyType from "./knightlands-shared/currency_type";
import CharacterStats from "./knightlands-shared/character_stat";
import { getUserMetadata, decodeToken } from "./Auth";

const Unit = require("./combat/unit");
const FloorEnemyUnit = require("./combat/floorEnemyUnit");
const IPaymentListener = require("./payment/IPaymentListener");
const ItemActions = require("./knightlands-shared/item_actions");
const Inventory = require("./inventory");
import CharacterStat from "./knightlands-shared/character_stat";
const Config = require("./config");

const {
    Collections,
    default: database
} = require("./database/database");

import Game from "./game";
import blockchains from "./knightlands-shared/blockchains";
import { Lock } from "./utils/lock";
import { exist, isNumber, isString } from "./validation";
import { GetArmy } from "./knightlands-shared/operations";

import { DungeonController } from "./events/simple-dungeon/DungeonController";
import { XmasController } from "./events/xmas/XmasController";
import { LunarController } from "./events/lunar/LunarController";
import { MarchController } from "./events/march/MarchController";
import { AprilController } from "./events/april/AprilController";
import { BattleController } from "./events/battle/BattleController";

const TowerFloorPageSize = 20;
const isProd = process.env.ENV == "prod";

class PlayerController extends IPaymentListener {
    constructor(socket) {
        super();

        this._socket = socket;
        this._lock = new Lock();

        if (socket.authToken) {
            this.address = socket.authToken.address;
            this.id = socket.authToken.id;
        }

        this._db = Game.db;
        this._raidManager = Game.raidManager;
        this._lootGenerator = Game.lootGenerator;
        this._signVerifier = Game.blockchain.getBlockchain(blockchains.Tron);
        this._opThrottles = {};

        // admin functions
        this._socket.on(Operations.GetQuestData, this._getQuestData.bind(this));

        // service functions
        this._socket.on(Operations.Auth, this._handleAuth.bind(this));
        this._socket.on(Operations.GetUserInfo, this._handleGetUserInfo.bind(this));
        this._socket.on(Operations.GetCurrencyConversionRate, this._getCurrencyConversionRate.bind(this));
        this._socket.on(Operations.SyncTime, this._syncTime.bind(this));
        this._socket.on(Operations.FetchRefillTimerStatus, this._fetchRefillTimerStatus.bind(this));
        this._socket.on(Operations.GetTimerRefillInfo, this._getTimerRefillInfo.bind(this));
        this._socket.on(Operations.FetchCharacter, this._fetchCharacter.bind(this));
        this._socket.on(Operations.GetOnline, this._getOnline.bind(this));

        // payed functions 
        this._socket.on(Operations.ChangeNickname, this._gameHandler(this._changeNickname.bind(this)));
        this._socket.on(Operations.ChangeAvatar, this._gameHandler(this._changeAvatar.bind(this)));
        // this._socket.on(Operations.SendPayment, this._acceptPayment.bind(this));
        this._socket.on(Operations.CancelPayment, this._gameHandler(this._cancelPayment.bind(this)));

        // raids
        this._socket.on(Operations.FetchRaidSummonStatus, this._gameHandler(this._raidInfo.bind(this)));
        this._socket.on(Operations.FetchRaidInfo, this._gameHandler(this._fetchRaid.bind(this)));
        this._socket.on(Operations.FetchRaidsList, this._gameHandler(this._fetchRaidsList.bind(this)));
        this._socket.on(Operations.SummonRaid, this._gameHandler(this._summonRaid.bind(this)));
        this._socket.on(Operations.JoinRaid, this._gameHandler(this._joinRaid.bind(this)));
        this._socket.on(Operations.AttackRaidBoss, this._gameHandler(this._attackRaidBoss.bind(this), "raid", Config.game.attackCooldown));
        this._socket.on(Operations.ClaimRaidLoot, this._gameHandler(this._claimLootRaid.bind(this)));
        this._socket.on(Operations.FetchRaidRewards, this._gameHandler(this._fetchRaidRewards.bind(this)));
        this._socket.on(Operations.FetchRaidPoints, this._gameHandler(this._fetchRaidPoints.bind(this)));
        this._socket.on(Operations.GetPublicRaids, this._gameHandler(this._fetchPublicRaids.bind(this)));
        this._socket.on(Operations.GetRaidPlayers, this._gameHandler(this._fetchRaidPlayers.bind(this)));

        // misc
        this._socket.on(Operations.ChangeClass, this._gameHandler(this._changeClass.bind(this)));
        this._socket.on(Operations.EngageQuest, this._gameHandler(this._engageQuest.bind(this), "quest", Config.game.attackCooldown));
        this._socket.on(Operations.UseItem, this._gameHandler(this._useItem.bind(this)));
        this._socket.on(Operations.OpenChest, this._gameHandler(this._openChest.bind(this)));
        this._socket.on(Operations.ResetZone, this._gameHandler(this._resetZone.bind(this)));
        this._socket.on(Operations.EquipItem, this._gameHandler(this._equipItem.bind(this)));
        this._socket.on(Operations.UnequipItem, this._gameHandler(this._unequipItem.bind(this)));
        this._socket.on(Operations.BuyStat, this._gameHandler(this._buyStat.bind(this)));
        this._socket.on(Operations.RefillTimer, this._gameHandler(this._refillTimer.bind(this)));
        this._socket.on(Operations.Tutorial, this._gameHandler(this._handleTutorial.bind(this)));
        this._socket.on(Operations.UpgradeAccount, this._gameHandler(this._toggleAccountType.bind(this)));

        // Founder sale
        this._socket.on(Operations.FetchFounderPresale, this._gameHandler(this._fetchFounderPresale.bind(this)));
        this._socket.on(Operations.DepositFounderPack, this._gameHandler(this._depositFounderPack.bind(this)));

        // Crafting
        this._socket.on(Operations.UpgradeItem, this._gameHandler(this._levelUpItem.bind(this)));
        this._socket.on(Operations.UnbindItem, this._gameHandler(this._unbindItem.bind(this)));
        this._socket.on(Operations.CraftItem, this._gameHandler(this._craftItem.bind(this)));
        this._socket.on(Operations.EnchantItem, this._gameHandler(this._enchantItem.bind(this)));
        this._socket.on(Operations.DisenchantItems, this._gameHandler(this._disenchantItems.bind(this)));
        this._socket.on(Operations.Convert, this._gameHandler(this._convert.bind(this)));
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
        // this._socket.on(Operations.FetchTowerAttemptsStatus, this._gameHandler(this._fetchTowerAttemptsStatus.bind(this)));

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

        // Gold exchange
        this._socket.on(Operations.BoostGoldExchange, this._gameHandler(this._boostGoldExchange.bind(this)));
        this._socket.on(Operations.PremiumBoostGoldExchange, this._gameHandler(this._premiumBoostGoldExchange.bind(this)));
        this._socket.on(Operations.ObtainGoldFromGoldExchange, this._gameHandler(this._obtainGoldFromGoldExchange.bind(this)));
        this._socket.on(Operations.GetGoldExchangeMeta, this._gameHandler(this._getGoldExchangeMeta.bind(this)));
        this._socket.on(Operations.FetchGoldExchangePremiumBoostStatus, this._gameHandler(this._fetchGoldExchangePremiumStatus.bind(this)));

        // Daily quests
        this._socket.on(Operations.ClaimDailyTasksRewards, this._gameHandler(this._claimDailyTasksRewards.bind(this)));

        // Dividends
        // this._socket.on(Operations.WithdrawDividendToken, this._gameHandler(this._withdrawDividendToken.bind(this)));
        this._socket.on(Operations.GetDivsStatus, this._gameHandler(this._getDividendsStatus.bind(this)));
        // this._socket.on(Operations.ClaimDivs, this._gameHandler(this._claimDividends.bind(this)));
        this._socket.on(Operations.ClaimMinedDkt, this._gameHandler(this._claimMinedDkt.bind(this)));
        this._socket.on(Operations.DivsMineUpgrade, this._gameHandler(this._upgradeDktMine.bind(this)));
        this._socket.on(Operations.DivsDropUpgrade, this._gameHandler(this._upgradeDktDropRate.bind(this)));
        this._socket.on(Operations.WithdrawTokens, this._gameHandler(this._withdrawTokens.bind(this)));
        this._socket.on(Operations.GetWithdrawTokensStatus, this._gameHandler(this._getWithdrawTokensStatus.bind(this)));
        // this._socket.on(Operations.StakeDivs, this._gameHandler(this._stakeDivs.bind(this)));
        this._socket.on(Operations.PendingDivs, this._gameHandler(this._getPendingDivs.bind(this)));
        this._socket.on(Operations.CancelAsset, this._gameHandler(this._cancelAsset.bind(this)));
        this._socket.on(Operations.FetchSeason, this._gameHandler(this._fetchSeason.bind(this)));

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

        // Prize pool
        this._socket.on(Operations.FetchPrizePool, this._gameHandler(this._fetchPrizePool.bind(this)));
        this._socket.on(Operations.GetPrizePoolRank, this._gameHandler(this._getPrizePoolRank.bind(this)));
        this._socket.on(Operations.GetPrizePoolRewards, this._gameHandler(this._getPrizePoolRewards.bind(this)));
        this._socket.on(Operations.PrizePoolWithdraw, this._gameHandler(this._withdrawPrizePool.bind(this)));

        // Army
        this._socket.on(Operations.GetArmy, this._gameHandler(this._getArmy.bind(this)));
        this._socket.on(Operations.SetLegionSlot, this._gameHandler(this._setLegionSlot.bind(this)));
        this._socket.on(Operations.SummonArmyUnit, this._gameHandler(this._summonArmyUnit.bind(this)));
        this._socket.on(Operations.GetArmySummonInfo, this._gameHandler(this._summonArmyInfo.bind(this)));
        this._socket.on(Operations.LevelUpArmyUnit, this._gameHandler(this._levelUpArmyUnit.bind(this)));
        this._socket.on(Operations.UnitEquipItem, this._gameHandler(this._unitEquipItem.bind(this)));
        this._socket.on(Operations.UnitUnequipItem, this._gameHandler(this._unitUnequipItem.bind(this)));
        this._socket.on(Operations.UnitPromo, this._gameHandler(this._unitPromotion.bind(this)));
        this._socket.on(Operations.UnitAbilityTransfer, this._gameHandler(this._unitTransferAbility.bind(this)));
        this._socket.on(Operations.UnitBanishment, this._gameHandler(this._unitBanish.bind(this)));
        this._socket.on(Operations.UnitReserve, this._gameHandler(this._unitReserve.bind(this)));
        this._socket.on(Operations.ExpandArmyInventory, this._gameHandler(this._expandArmyInventory.bind(this)));

        // Gold mines
        this._socket.on(Operations.UpgradeMine, this._gameHandler(this._upgradeMine.bind(this)));
        this._socket.on(Operations.UpgradeMineStorage, this._gameHandler(this._upgradeMineStorage.bind(this)));
        this._socket.on(Operations.ExpandMine, this._gameHandler(this._expandMine.bind(this)));
        this._socket.on(Operations.CollectMine, this._gameHandler(this._collectMine.bind(this)));

        // Inventory
        this._socket.on(Operations.LockItem, this._gameHandler(this._lockItem.bind(this)));
        this._socket.on(Operations.UnlockItem, this._gameHandler(this._unlockItem.bind(this)));

        // Shop
        this._socket.on(Operations.Purchase, this._gameHandler(this._purchase.bind(this)));
        this._socket.on(Operations.PurchaseStatus, this._gameHandler(this._purchaseStatus.bind(this)));
        this._socket.on(Operations.PurchaseDailyItem, this._gameHandler(this._purchaseDailyItem.bind(this)));
        this._socket.on(Operations.RefreshDailyShop, this._gameHandler(this._refreshDailyShop.bind(this)));

        // Simple dungeon
        if (!isProd) {
            this._socket.on(Operations.SDungeonGenerateNew, this._gameHandler(this._sDungeonGenerate.bind(this)));
            this._socket.on(Operations.SDungeonTestAction, this._gameHandler(this._sDungeonTestAction.bind(this)));
        }

        this._socket.on(Operations.SDungeonRevealCell, this._gameHandler(this._sDungeonReveal.bind(this)));
        this._socket.on(Operations.SDungeonUseCell, this._gameHandler(this._sDungeonUseCell.bind(this)));
        this._socket.on(Operations.SDungeonLoad, this._gameHandler(this._sDungeonLoad.bind(this)));
        this._socket.on(Operations.SDunegonCombatAction, this._gameHandler(this._sDungeonCombatAction.bind(this)));
        this._socket.on(Operations.SDungeonMove, this._gameHandler(this._sDungeonMove.bind(this)));
        this._socket.on(Operations.SDungeonUseItem, this._gameHandler(this._sDungeonUseItem.bind(this)));
        this._socket.on(Operations.SDungeonNextFloor, this._gameHandler(this._sDungeonNextFloor.bind(this)));
        this._socket.on(Operations.SDungeonEquip, this._gameHandler(this._sDungeonEquip.bind(this)));
        this._socket.on(Operations.SDungeonPath, this._gameHandler(this._sDungeonPath.bind(this)));
        this._socket.on(Operations.SDungeonRank, this._gameHandler(this._sDungeonRank.bind(this)));
        this._socket.on(Operations.SDungeonEnter, this._gameHandler(this._sDungeonEnter.bind(this)));
        this._socket.on(Operations.SDunegonCommitStats, this._gameHandler(this._sDungeonCommitStats.bind(this)));
        this._socket.on(Operations.SDungeonWithdraw, this._gameHandler(this._sDungeonWithdrwa.bind(this)));

        // Xmas
        // this._socket.on(Operations.XmasLoad, this._gameHandler(this._xmasLoad.bind(this)));
        // this._socket.on(Operations.XmasFarmUpgrade, this._gameHandler(this._xmasFarmUpgrade.bind(this)));
        // this._socket.on(Operations.XmasHarvest, this._gameHandler(this._xmasHarvest.bind(this)));
        // this._socket.on(Operations.XmasCommitPerks, this._gameHandler(this._xmasCommitPerks.bind(this)));
        // this._socket.on(Operations.XmasCommitSlotPerks, this._gameHandler(this._xmasXmasCommitSlotPerks.bind(this)));
        // this._socket.on(Operations.XmasUpdateLevelGap, this._gameHandler(this._xmasUpdateLevelGap.bind(this)));
        // this._socket.on(Operations.XmasCPointsStatus, this._gameHandler(this._xmasCPointsStatus.bind(this)));
        // this._socket.on(Operations.XmasActivatePerk, this._gameHandler(this._xmasXmasActivatePerk.bind(this)));
        // this._socket.on(Operations.XmasRebalancePerks, this._gameHandler(this._xmasXmasRebalancePerks.bind(this)));

        // Lunar
        // this._socket.on(Operations.LunarLoad, this._gameHandler(this._lunarLoad.bind(this)));
        // this._socket.on(Operations.LunarCraft, this._gameHandler(this._lunarCraft.bind(this)));
        // this._socket.on(Operations.LunarExchange, this._gameHandler(this._lunarExchange.bind(this)));
        // this._socket.on(Operations.LunarCollectDailyReward, this._gameHandler(this._lunarCollectDailyReward.bind(this)));
        // this._socket.on(Operations.LunarTestAction, this._gameHandler(this._lunarTestAction.bind(this)));
        // this._socket.on(Operations.LunarPurchase, this._gameHandler(this._lunarPurchase.bind(this)));

        // March
        // this._socket.on(Operations.MarchLoad, this._gameHandler(this._marchLoad.bind(this)));
        // this._socket.on(Operations.MarchStartNewGame, this._gameHandler(this._marchStartNewGame.bind(this)));
        // this._socket.on(Operations.MarchExitGame, this._gameHandler(this._marchExitGame.bind(this)));
        // this._socket.on(Operations.MarchTouch, this._gameHandler(this._marchTouch.bind(this)));
        // this._socket.on(Operations.MarchCollectDailyReward, this._gameHandler(this._marchCollectDailyReward.bind(this)));
        // this._socket.on(Operations.MarchTestAction, this._gameHandler(this._marchTestAction.bind(this)));
        // this._socket.on(Operations.MarchPurchaseGold, this._gameHandler(this._marchPurchaseGold.bind(this)));
        // this._socket.on(Operations.MarchOpenChest, this._gameHandler(this._marchOpenChest.bind(this)));
        // this._socket.on(Operations.MarchUnlockPet, this._gameHandler(this._marchUnlockPet.bind(this)));
        // this._socket.on(Operations.MarchUpgradePet, this._gameHandler(this._marchUpgradePet.bind(this)));
        // this._socket.on(Operations.MarchRanking, this._gameHandler(this._marchRanking.bind(this)));
        // this._socket.on(Operations.MarchClaimRewards, this._gameHandler(this._marchClaimRewards.bind(this)));

        // April
        //this._socket.on(Operations.AprilLoad, this._gameHandler(this._aprilLoad.bind(this)));
        //this._socket.on(Operations.AprilClaimReward, this._gameHandler(this._aprilClaimReward.bind(this)));
        //this._socket.on(Operations.AprilRankings, this._gameHandler(this._aprilRankings.bind(this)));
        //this._socket.on(Operations.AprilHeroStat, this._gameHandler(this._aprilHeroStat.bind(this)));
        //this._socket.on(Operations.AprilPurchaseHero, this._gameHandler(this._aprilPurchaseHero.bind(this)));
        //this._socket.on(Operations.AprilRestart, this._gameHandler(this._aprilRestart.bind(this)));
        //this._socket.on(Operations.AprilMove, this._gameHandler(this._aprilMove.bind(this)));
        //this._socket.on(Operations.AprilSkip, this._gameHandler(this._aprilSkip.bind(this)));
        //this._socket.on(Operations.AprilPurchaseAction, this._gameHandler(this._aprilPurchaseAction.bind(this)));
        //this._socket.on(Operations.AprilPurchaseGold, this._gameHandler(this._aprilPurchaseGold.bind(this)));
        //this._socket.on(Operations.AprilEnterLevel, this._gameHandler(this._aprilEnterLevel.bind(this)));
        //this._socket.on(Operations.AprilResurrect, this._gameHandler(this._aprilResurrect.bind(this)));
        //this._socket.on(Operations.AprilExit, this._gameHandler(this._aprilExit.bind(this)));
        //this._socket.on(Operations.AprilTestAction, this._gameHandler(this._aprilTestAction.bind(this)));
        //this._socket.on(Operations.AprilPurchaseTicket, this._gameHandler(this._aprilPurchaseTicket.bind(this)));

        // Battle
        this._socket.on(Operations.BattleLoad, this._gameHandler(this._battleLoad.bind(this)));
        this._socket.on(Operations.BattleClaimReward, this._gameHandler(this._battleClaimReward.bind(this)));
        this._socket.on(Operations.BattlePurchase, this._gameHandler(this._battlePurchase.bind(this)));
        this._socket.on(Operations.BattleFillSquadSlot, this._gameHandler(this._battleFillSquadSlot.bind(this)));
        this._socket.on(Operations.BattleClearSquadSlot, this._gameHandler(this._battleClearSquadSlot.bind(this)));
        this._socket.on(Operations.BattleUpgradeUnitLevel, this._gameHandler(this._battleUpgradeUnitLevel.bind(this)));
        this._socket.on(Operations.BattleUpgradeUnitAbility, this._gameHandler(this._battleUpgradeUnitAbility.bind(this)));
        this._socket.on(Operations.BattleApply, this._gameHandler(this._battleApply.bind(this)));
        this._socket.on(Operations.BattleSkip, this._gameHandler(this._battleSkip.bind(this)));
        this._socket.on(Operations.BattleEnterLevel, this._gameHandler(this._battleEnterLevel.bind(this)));
        this._socket.on(Operations.BattleEnterDuel, this._gameHandler(this._battleEnterDuel.bind(this)));
        this._socket.on(Operations.BattleFetchDuelOptions, this._gameHandler(this._battleFetchDuelOptions.bind(this)));
        this._socket.on(Operations.BattleRankings, this._gameHandler(this._battleRankings.bind(this)));
        this._socket.on(Operations.BattleRestart, this._gameHandler(this._battleRestart.bind(this)));
        this._socket.on(Operations.BattleExit, this._gameHandler(this._battleExit.bind(this)));
        this._socket.on(Operations.BattleTestAction, this._gameHandler(this._battleTestAction.bind(this)));
        
        this._handleEventBind = this._handleEvent.bind(this);
    }

    get socket() {
        return this._socket;
    }

    async forceDisconnect(code, reason) {
        this._closed = true;
        await this.onDisconnect(true);
        this.socket.disconnect(code, reason);
    }

    async onDisconnect(forced = false) {
        if (this._closed && !forced) {
            return false;
        }

        Game.off(this.address, this._handleEventBind);
        Game.off(this.id, this._handleEventBind);

        if (this._user) {
            this._user.dispose();
        }

        this.address = null;

        if (this.simpleDungeon) {
            // console.log('start dungeon dispose')
            await this.simpleDungeon.dispose();
            // console.log('finish dungeon dispose')
            this.simpleDungeon = null
        }

        if (this.xmas) {
            this.xmas = null
        }

        if (this.lunar) {
            await this.lunar.dispose();
            this.lunar = null
        }

        if (this.march) {
            await this.march.dispose();
            this.march = null
        }

        if (this.april) {
            await this.april.dispose();
            this.april = null
        }

        if (this.battle) {
            await this.battle.dispose();
            this.battle = null
        }

        return true;
    }

    async onAuthenticated() {
        Game.removeAllListeners(this.address)
        Game.on(this.address, this._handleEventBind);

        Game.removeAllListeners(this.id)
        Game.on(this.id, this._handleEventBind);

        const user = await this.getUser();
        this.simpleDungeon = new DungeonController(user);
        await this.simpleDungeon.init();

        this.xmas = new XmasController(user);
        await this.xmas.init();

        this.lunar = new LunarController(user);
        await this.lunar.init();

        this.march = new MarchController(user);
        await this.march.init();

        this.april = new AprilController(user);
        await this.april.init();

        this.battle = new BattleController(user);
        await this.battle.init();
    }

    async onPayment(iap, eventToTrigger, context) {
        this._socket.emit(eventToTrigger, {
            iap,
            context
        });
    }

    async onDividendTokenWithdrawal(success) {
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
        try {
            if (this._socket.authToken) {
                respond("authenticated");
                return;
            }

            const metadata = await getUserMetadata(data.token);
            const decodedToken = await decodeToken(data.token);

            this.address = metadata.email;

            const userLastLogin = await this._db.collection(Collections.Users).findOne({ address: this.address }, { projection: { lastLogin: 1 } });
            if (userLastLogin) {
                if (userLastLogin.lastLogin >= decodedToken[1].iat) {
                    throw Errors.MalformedAuth;
                }
            }

            await this.getUser();

            this._socket.setAuthToken({
                address: this.address,
                id: this.id
            });

            respond(null, "success");
        } catch (e) {
            console.error(e);
            respond(e);
        }
    }

    async _handleEvent(event, args) {
        switch (event) {
            case Inventory.Changed:
                this._socket.emit(Events.InventoryUpdate, args);

                const user = await this.getUser();
                await user.onInventoryChanged(args);
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

    async _getOnline(data, respond) {
        respond(null, { online: Game.getTotalOnline() });
    }

    /**
     * @deprecated since 2021-09-27
     */
    async getUser(address) {
        await this._lock.acquire("get-user");

        try {
            if (!this._user) {
                this._user = await Game.loadUser(address || this.address);
                this.id = this._user.id.toString();
            }
        } finally {
            await this._lock.release("get-user");
        }

        return this._user;
    }

    async _getCurrencyConversionRate(data, respond) {
        respond(null, {
            rate: Game.currencyConversionService.conversionRate(data.currency)
        });
    }

    async _getQuestData(_, respond) {
        let zones = await this._db.collection(Collections.Zones).find({}).toArray();
        respond(null, zones);
    }

    _gameHandler(handler, throttleId = "default", throttle = 0) {
        return async(data, respond) => {
            await this._lock.acquire("game_handler");

            try {
                if (this.address == null || this.address == undefined) {
                    return;
                }

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
                    await user.commitChanges();

                    respond(null, { response });
                } catch (error) {
                    console.error(error)
                    respond(error);
                }
            } finally {
                await this._lock.release("game_handler");
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

        let zone = Game.questZones.getZone(data.zone);

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

        if (+data.stage * Game.questZones.totalZones + data.zone > user.level) {
            throw Errors.IncorrectArguments;
        }

        // check if previous zone was completed on the same stage
        let previousZone = Game.questZones.getZone(data.zone - 1);

        if (previousZone && !user.isZoneCompleted(previousZone._id, data.stage)) {
            throw "complete previous zone";
        }

        if (data.stage > 0) {
            // check if previous zones finished
            if (!user.isZoneCompleted(Game.questZones.totalZones, data.stage - 1)) {
                throw "complete previous difficulty";
            }
        }

        let itemsToDrop = 0;
        let questComplete = false;
        let damages = [];
        let resourcesGained = {
            soft: 0,
            exp: 0
        };

        // calculate hits
        let hits = 1;
        if (await user.hasFastCombat()) {
            hits = 3;
        }

        if (isBoss) {
            let allQuestsFinished = true;
            for (let index = 0; index < zone.quests.length; index++) {
                const quest = zone.quests[index];
                let otherQuestProgress = user.getQuestProgress(data.zone, index, data.stage);
                if (!otherQuestProgress || otherQuestProgress.hits < quest.stages[data.stage].hits) {
                    allQuestsFinished = false;
                    break;
                }
            }

            let bossProgress = user.getQuestBossProgress(zone._id, data.stage);
            if (allQuestsFinished) {
                // unlock final boss
                bossProgress.unlocked = true;
            }

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

            while (user.enoughHp && bossUnit.isAlive && hits > 0) {
                // exp and gold are calculated based on damage inflicted
                let attackResult = playerUnit.attack(bossUnit);
                damages.push(attackResult);

                bossUnit.attack(playerUnit);

                bossProgress.exp += bossData.exp * (attackResult.damage / bossUnit.getMaxHealth());
                let expGained = Math.floor(bossProgress.exp);
                bossProgress.exp -= expGained;
                resourcesGained.exp += expGained;

                bossProgress.gold += Random.range(bossData.goldMin, bossData.goldMax) * (attackResult.damage / bossUnit.getMaxHealth());
                let softCurrencyGained = Math.floor(bossProgress.gold);
                bossProgress.gold -= softCurrencyGained;
                resourcesGained.soft += softCurrencyGained;

                hits--;
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

            hits = Math.min(quest.hits - questProgress.hits, hits);

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

            while (hits-- > 0) {
                resourcesGained.exp += quest.exp;
                resourcesGained.soft += Math.floor(Random.range(quest.goldMin, quest.goldMax));
            }

            // will reset if current quest is not complete 
            questComplete = questProgress.hits < zone.quests[data.questIndex].stages[data.stage].hits;
        }

        await user.addSoftCurrency(resourcesGained.soft);
        await user.addExperience(resourcesGained.exp, false, "quest");

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

        if (questComplete) {
            user.resetZoneProgress(zone, data.stage);
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
        if (!Number.isInteger(count) || count <= 0) {
            count = 1;
        }

        return user.useItem(data.itemId, count);
    }

    async _openChest(user, data) {
        let { chest, iap, count } = data;

        // each chest has corresponding item attached to it to open
        let gachaMeta = await this._db.collection(Collections.GachaMeta).findOne({ name: chest });
        if (!gachaMeta) {
            throw Errors.UnknownChest;
        }

        let freeOpening = false;
        let chestsToOpen = count || 1;

        if (+iap >= 0 && gachaMeta.iaps[iap]) {
            const price = gachaMeta.iaps[iap].price;
            if (user.hardCurrency < price) {
                throw Errors.NotEnoughCurrency;
            }

            await user.addHardCurrency(-price);
            chestsToOpen = gachaMeta.iaps[iap].count;
        } else {
            // check if this is free opening
            if (gachaMeta.freeOpens > 0) {
                let chests = user.getChests();
                let cycleLength = 86400000 / gachaMeta.freeOpens; // 24h is base cycle

                if (!chests[chest] || Game.now - chests[chest] >= cycleLength) {
                    user.setChestFreeOpening(chest);
                    freeOpening = true;
                }
            }

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
        }

        return Game.lootGenerator.openChest(user, chest, chestsToOpen, freeOpening);
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

    async _toggleAccountType(user, data) {
        await user.toggleAccountType();
    }

    // Founder sale
    async _depositFounderPack(user, data) {
        const { from, chain, tokenIds } = data;

        if (!isString(from) || !isString(chain) || !Array.isArray(tokenIds)) {
            throw Errors.IncorrectArguments;
        }

        return user.founderSale.depositCards(tokenIds, from, chain);
    }

    async _fetchFounderPresale(user, data) {
        const { from } = data;

        if (!isString(from)) {
            throw Errors.IncorrectArguments;
        }

        const deposits = await Game.db.collection(Collections.PresaleCardDeposits).find({ user: user.id, from: from }).toArray();
        const depositedTokens = {};
        const tokens = [];
        // remove finished deposits, keep pending deposits
        for (const record of deposits) {
            for (const tokenId of record.tokenIds) {
                depositedTokens[tokenId] = true;
                tokens.push({
                    tokenId,
                    pending: record.pending,
                    depositId: record._id.toString()
                });
            }
        }

        // mark the rest of the tokens as depositable if applicable
        const ownedTokens = await Game.db.collection("founder_presale").find({ from: from }, { projection: { _id: 0 } }).toArray();
        for (const record of ownedTokens) {
            if (depositedTokens[record.tokenId]) {
                continue;
            }

            tokens.push({
                tokenId: record.tokenId,
                canDeposit: user.founderSale.verifyToken(record.tokenId)
            });
        }

        return tokens;
    }

    async _handleTutorial(user, data) {
        if (!isNumber(data.id)) {
            throw Errors.IncorrectArguments;
        }

        user.finishTutorial(+data.id);
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
            items,
            restores
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

        if (timer.value >= user.getMaxStatValue(stat)) {
            throw Errors.IncorrectArguments;
        }

        if (refillType == 1) {
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
            if (!Number.isInteger(restores)) {
                throw Errors.IncorrectArguments;
            }

            // check that restore
            let refillAmount = await user.getRefillAmount(stat, restores);

            if (stat != CharacterStat.Health) {
                const refillMeta = await user.getMeta("refill");
                if (refillAmount - user.getMaxStatValue(stat) > refillMeta[stat][user.level - 1]) {
                    throw Errors.IncorrectArguments;
                }
            }


            let refillCost = await user.getTimerRefillCost(stat, restores);
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

            await user.refillTimer(stat, restores);
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

    async _fetchCharacter(data, respond) {
        try {
            const userPreview = await Game.loadUserPreview(data.id);
            respond(null, userPreview);
        } catch (exc) {
            respond(Errors.UnknownPlayer);
        }
    }

    async _fetchRefillTimerStatus(data, respond) {
        let timeRefillInfo = await Game.userPremiumService.getTimerRefillStatus(this.address, data.stat);
        respond(null, timeRefillInfo);
    }

    async _changeAvatar(user, data) {
        if (!isNumber(data.id) || data.id < 1) {
            throw Errors.IncorrectArguments;
        }

        // check if avatar feets the requirements
        const avatars = await this._db.collection(Collections.Meta).findOne({ _id: "avatars" });
        const avatarMeta = avatars.unlockables[data.id];
        if (avatarMeta.level && avatarMeta.level > user.level) {
            throw Errors.NotEnoughLevel;
        }

        if (avatarMeta.userFlag && !user.hasFlag(avatarMeta.userFlag)) {
            throw Errors.IncorrectArguments;
        }

        user.avatar = data.id;
    }

    async _changeNickname(user, data) {
        if (!data.nickname || !data.nickname.match(/^[a-zA-Z0-9_-]{3,16}$/g)) {
            throw Errors.IncorrectArguments;
        }

        const meta = await this._db.collection(Collections.Meta).findOne({ _id: "meta" }, { projection: { nicknamePrice: 1 } })
        let price = 0;

        if (user.nickname && user.nickname.changed) {
            price = meta.nicknamePrice;
        }

        if (user.hardCurrency < price) {
            throw Errors.NotEnoughCurrency;
        }

        const isExist = await this._db.collection(Collections.Users).findOne({ "character.name.v": data.nickname }, { projection: { _id: 1 } });
        if (isExist) {
            throw Errors.NameUsed;
        }

        await user.addHardCurrency(-price);
        user.nickname = {
            v: data.nickname,
            changed: user.nickname ? 1 : 0
        };
    }

    // Raids
    async _raidInfo(user, data) {
        return this._raidManager.fetchRaidCurrentMeta(user.id, data.raid, data.free);
    }

    async _fetchRaid(user, data) {
        return this._raidManager.getRaidInfo(user.id, data.raidId);
    }

    async _fetchRaidsList(user, data) {
        return this._raidManager.getCurrentRaids(user.id);
    }

    async _summonRaid(user, data) {
        if (!isNumber(data.raid)) {
            throw Errors.IncorrectArguments;
        }

        const raidId = +data.raid;
        const meta = await Game.db.collection(Collections.RaidsMeta).findOne({ _id: "meta" });

        if (data.free) {
            if (user.getSoloRaidAttempts(raidId) == meta.dailySoloLimit) {
                throw Errors.ExhaustedSoloRaidAttempts;
            }
        } else {
            if (Game.nowSec - user.getLastRaidSummon(raidId) < meta.groupRaidSummonCooldown) {
                throw Errors.IncorrectArguments;
            }
        }

        const result = await this._raidManager.summonRaid(user, raidId, data.free, data.options.public);
        if (data.free) {
            user.increaseSoloRaidAttempts(raidId);
        } else {
            user.setRaidSummoned(raidId);
        }

        return result;
    }

    async _joinRaid(user, data) {
        return this._raidManager.joinRaid(user.id, data.raidId);
    }

    async _attackRaidBoss(user, data) {
        if (!isNumber(data.hits) || !Number.isInteger(data.hits) || !isNumber(data.legionIndex) || !Number.isInteger(data.legionIndex)) {
            throw Errors.IncorrectArguments;
        }

        let raid = this._raidManager.getRaid(data.raidId);
        if (!raid) {
            throw Errors.InvalidRaid;
        }

        return raid.attack(user, parseInt(data.hits), parseInt(data.legionIndex));
    }

    async _fetchRaidRewards(user, data) {
        return this._raidManager.getLootPreview(user, data.raidId);
    }

    async _fetchRaidPoints(user, data) {
        return user.raidPoints.getInfo();
    }

    async _claimLootRaid(user, data) {
        const rewards = await this._raidManager.claimLoot(user, data.raidId);

        if (!rewards) {
            throw Errors.NoRewards;
        }

        await user.addSoftCurrency(rewards.gold);
        await user.addExperience(rewards.exp, false, "raid");
        await user.inventory.addItemTemplates(rewards.items);
        await user.addRP(rewards.rp, true);
        await user.addHardCurrency(rewards.hardCurrency);

        return rewards;
    }

    async _fetchPublicRaids(user, data) {
        return this._raidManager.fetchPublicRaids(user.id, user.level, +data.page);
    }

    async _fetchRaidPlayers(user, data) {
        return this._raidManager.fetchPlayersFromRaid(data.raid);
    }

    // crafting
    // if item never have been modified server will return new item id for created unique version
    async _levelUpItem(user, data) {
        const { materials, itemId } = data;

        let leveledItemId = await user.levelUpItem(+itemId, materials);

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

        return user.crafting.craftRecipe(recipeId, currency, amount);
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

        return user.enchantItem(itemId, currency);
    }

    async _disenchantItems(user, data) {
        return user.crafting.disenchantItems(data.items);
    }

    async _convert(user, data) {
        return user.crafting.convert(data.conversions, data.entity);
    }

    async _createWeapon(user, data) {
        const { recipeId, currency, itemId, element } = data;
        return user.crafting.createWeapon(recipeId, currency, itemId, element);
    }

    async _evolveItem(user, data) {
        const { itemId, extraItem } = data;
        return user.crafting.evolve(itemId, extraItem);
    }

    async _craftAccessory(user, data) {
        return user.crafting.createAccessory(+data.template, +data.count);
    }

    async _rerollAccessory(user, data) {
        return user.crafting.rerollAccessory(+data.itemId);
    }

    async _cancelRerollAccessory(user, data) {
        return user.crafting.rollbackRerollAccessory(+data.itemId);
    }

    // Adventures
    async _buyAdventureSlot(user, data) {
        return user.buyAdventureSlot();
    }

    async _fetchAdventuresStatus(user, data) {
        return user.getAdventuresStatus();
    }

    async _startAdventure(user, data) {
        return user.startAdventure(data.slot * 1, data.adventureIndex * 1);
    }

    async _claimAdventure(user, data) {
        return user.claimAdventure(data.slot * 1);
    }

    async _refreshAdventures(user, data) {
        return user.refreshAdventure(data.slot * 1);
    }

    // Classes
    async _changeClass(user, data) {
        return user.selectClass(data.class);
    }

    // Daily rewards
    async _fetchDailyRewardStatus(user) {
        return user.getDailyRewardStatus();
    }

    async _collectDailyReward(user) {
        return user.collectDailyReward();
    }

    async _fetchDailyRefillsStatus(user) {
        return user.getDailyRefillsStatus();
    }

    async _collectDailyRefills(user) {
        return user.collectDailyRefills();
    }

    // Beast boosting
    async _beastRegularBoost(user, data) {
        return user.beastBoost(+data.count, true);
    }

    async _beastAdvancedBoost(user, data) {
        return user.beastBoost(+data.count, false, +data.iapIndex);
    }

    async _evolveBeast(user) {
        return user.evolveBeast();
    }

    async _fetchBeastBoostPurchase(user) {
        return Game.userPremiumService.getBeastBoostPurchaseStatus(this.address);
    }

    async _cancelPayment(user, data) {
        return Game.paymentProcessor.cancelPayment(user.id, data.id);
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

            const totalFloors = await this._db.collection(Collections.TowerMeta).find().count()
            if (floorsCleared >= totalFloors - 1) { // it has a "misc" record, which we can just ignore, legacy stuff, redo it!
                page -= 1;
            }
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
        towerFloor.userLevel = user.level;
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
        const floorEnemyUnit = new FloorEnemyUnit(towerFloor.attack, towerFloor.health, 1);

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

        return this._sendRewardsForTowerFloor(floor, false);
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
            const floorData = await this._db.collection(Collections.TowerMeta).find({
                _id: {
                    $in: [
                        towerFloor.id, "misc"
                    ]
                }
            }).toArray();
            const miscMeta = floorData.find(x => x._id == "misc");
            const ticketItem = user.inventory.getItemByTemplate(miscMeta.ticketItem);
            if (!ticketItem) {
                throw Errors.TowerNoTicket;
            }

            user.inventory.removeItem(ticketItem.id, 1);
        }

        return this._sendRewardsForTowerFloor(towerFloor.id, firstClearance);
    }

    async _sendRewardsForTowerFloor(floor, firstClearance) {
        const floorMeta = await this._db.collection(Collections.TowerMeta).findOne({ _id: floor });
        const loot = firstClearance ? floorMeta.firstClearReward : floorMeta.repeatClearReward;

        const items = await Game.lootGenerator.getLootFromTable(loot);

        await this._user.addSoftCurrency(floorMeta.softCurrency, true);
        await this._user.addExperience(floorMeta.exp, true, "tower");
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
        if (!isNumber(data.index)) {
            throw Errors.IncorrectArguments;
        }

        if (user.towerPurchased) {
            throw Errors.AlreadyPurchased;
        }

        const towerMiscMeta = await this._db.collection(Collections.TowerMeta).findOne({ _id: "misc" });
        if (towerMiscMeta.iaps.length <= data.index) {
            throw Errors.IncorrectArguments;
        }

        const iap = towerMiscMeta.iaps[data.index];
        if (user.hardCurrency < iap.price) {
            throw Errors.NotEnoughCurrency;
        }

        // add tickets
        await user.inventory.addItemTemplate(towerMiscMeta.ticketItem, iap.attempts);
        await user.addHardCurrency(-iap.price);
        user.towerPurchased = true;
    }

    // Trials
    async _fetchTrialState(user, data) {
        return user.getTrialState(data.trialType, data.trialId);
    }

    async _challengeTrialFight(user, data) {
        return user.challengeTrial(data.trialType, data.trialId, data.stageId, data.fightIndex);
    }

    async _collectTrialStageReward(user, data) {
        return user.collectTrialStageReward(data.trialType, data.trialId, data.stageId);
    }

    async _fetchTrialFightMeta(user, data) {
        return user.fetchTrialFightMeta(data.trialType, data.trialId, data.stageId, data.fightIndex);
    }

    async _attackTrial(user, data) {
        return user.attackTrial(data.trialType);
    }

    async _chooseTrialCard(user, data) {
        return user.chooseTrialCard(data.trialType, data.cardIndex * 1);
    }

    async _improveTrialCard(user, data) {
        return user.improveTrialCard(data.cardEffect);
    }

    async _resetTrialCards(user) {
        return user.resetTrialCards();
    }

    async _summonTrialCards(user, data) {
        return user.summonTrialCards(data.trialType);
    }

    async _purchaseTrialAttempts(user, data) {
        return user.purchaseTrialAttempts(data.trialType, +data.iapIndex);
    }

    // Gold Exchange
    async _boostGoldExchange(user, data) {
        return user.goldExchange.freeBoost();
    }

    async _premiumBoostGoldExchange(user, data) {
        return Game.userPremiumService.requireGoldExchangeBoost(this.address, data.count * 1);
    }

    async _obtainGoldFromGoldExchange(user, data) {
        return user.goldExchange.obtainGold();
    }

    async _getGoldExchangeMeta(user) {
        return user.goldExchange.levelMeta;
    }

    async _fetchGoldExchangePremiumStatus() {
        return Game.userPremiumService.getGoldExchangePremiumStatus(this.address);
    }

    // Daily Quests
    async _claimDailyTasksRewards(user, data) {
        return user.dailyQuests.claimRewards(data.taskType);
    }

    // Dividends
    async _getPendingDivs(user, data) {
        return user.dividends.getPendingWithdrawal(data.chain, !!data.tokens);
    }

    async _fetchSeason(user, data) {
        return Game.season.getStatus();
    }

    async _cancelAsset(user, data) {
        return user.dividends.cancelAction(data);
    }

    async _getDividendsStatus(user) {
        return Game.dividends.getStatus(user.id);
    }

    async _withdrawDividendToken(user, data) {
        return user.dividends.withdrawDividends(data.to, data.blockchainId);
    }

    async _claimDividends(user, data) {
        return user.dividends.claimDividends(data.blockchainId);
    }

    async _claimMinedDkt(user) {
        return user.dividends.claimMinedDkt();
    }

    async _upgradeDktMine(user) {
        return user.dividends.upgradeDktMine();
    }

    async _upgradeDktDropRate(user) {
        return user.dividends.upgradeDktDropRate();
    }

    async _purchaseDktShopItem(user, data) {
        return user.dividends.purchase(+data.itemId);
    }

    async _withdrawTokens(user, data) {
        return user.dividends.withdrawTokens(data.to, data.type, data.chain, data.amount);
    }

    async _getWithdrawTokensStatus(user, data) {
        return Game.activityHistory.getHistory(user.id);
    }

    async _stakeDivs(user, data) {
        return user.dividends.stake(data.amount);
    }

    // Tournaments
    async _fetchTournaments(user, data) {
        return Game.rankings.tournaments.getTournamentsInfo(user.id);
    }

    async _joinTournament(user, data) {
        return Game.rankings.tournaments.join(user.id, data.tournamentId);
    }

    async _claimTournamentRewards(user, data) {
        let rewards = await Game.rankings.tournaments.claimRewards(user.id, data.tournamentId);
        if (!rewards) {
            throw Errors.NoRewards;
        }

        await user.inventory.addItemTemplates(rewards);
        await user.addDkt(rewards.tokens, true);

        return rewards;
    }

    async _fetchTournamentRankings(user, data) {
        return Game.rankings.tournaments.getRankings(data.tournamentId, parseInt(data.page));
    }

    async _getTournamentInfo(user, data) {
        return Game.rankings.tournaments.getRank(data.tournamentId, user.id);
    }

    async _getFinishedTournaments(user, data) {
        return Game.rankings.tournaments.getFinishedTournaments(user.id);
    }

    async _getTournamentRewards(user, data) {
        return Game.rankings.tournaments.getRewards(data.tournamentId);
    }

    // Races
    async _fetchRaces(user, data) {
        return Game.rankings.races.getRacesInfo(user.id);
    }

    async _joinRace(user, data) {
        return Game.rankings.races.join(user.id, data.raceId);
    }

    async _claimRaceRewards(user, data) {
        let rewards = await Game.rankings.races.claimRewards(user.id, data.raceId);
        if (!rewards) {
            throw Errors.NoRewards;
        }

        await user.inventory.addItemTemplates(rewards);

        return rewards;
    }

    async _getRaceInfo(user, data) {
        return Game.rankings.races.getRank(data.raceId, user.id);
    }

    async _fetchRaceRankings(user, data) {
        return Game.rankings.races.getRankings(data.raceId, parseInt(data.page));
    }

    async _getFinishedRaces(user, data) {
        return Game.rankings.races.getFinishedRaces(user.id);
    }

    async _getRaceRewards(user, data) {
        return Game.rankings.races.getRewards(data.raceId);
    }

    async _getRaceShop() {
        return Game.rankings.races.getShop();
    }

    async _purchaseFromRaceShop(user, data) {
        return user.raceShop.purchase(data.lotId);
    }

    // Leaderboards
    async _getLeaderboardRankings(user, data) {
        return Game.rankings.leaderboards.getRankings(parseInt(data.type), parseInt(data.page));
    }

    async _getLeaderboardRank(user, data) {
        return Game.rankings.leaderboards.getUserRank(parseInt(data.type), user.id);
    }

    // Prize pool
    async _fetchPrizePool(user, data) {
        return Game.prizePool.getRankings(parseInt(data.page));
    }

    async _getPrizePoolRank(user, data) {
        return Game.prizePool.getUserRank(user.id);
    }

    async _getPrizePoolRewards(user, data) {
        return Game.prizePool.getRewards();
    }

    async _withdrawPrizePool(user, data) {
        if (typeof data.to !== 'string') {
            throw Errors.IncorrectArguments;
        }

        return Game.prizePool.createOrGetWithdrawRequest(user.id, data.to);
    }

    // Armies
    async _getArmy(user, data) {
        return Game.armyManager.getArmy(user);
    }

    async _setLegionSlot(user, data) {
        await Game.armyManager.setLegionSlot(user, user.level, data.legionIndex, data.slotId, data.unitId);
    }

    async _summonArmyUnit(user, data) {
        const { iap, count, summonType } = data;
        if (!isNumber(count)) {
            throw Errors.IncorrectArguments;
        }

        return Game.armyManager.summontUnits(user, count, summonType, iap);
    }

    async _summonArmyInfo(user, data) {
        return Game.armyManager.getSummonOverview(user);
    }

    async _levelUpArmyUnit(user, data) {
        return Game.armyManager.levelUp(user, data.unitId);
    }

    async _unitEquipItem(user, data) {
        return Game.armyManager.equipItem(user, data.unitId, data.itemIds);
    }

    async _unitUnequipItem(user, data) {
        return Game.armyManager.unequipItem(user, data.unitId, data.slotId);
    }

    async _unitPromotion(user, data) {
        return Game.armyManager.promote(user, data.unitId, data.units);
    }

    async _unitBanish(user, data) {
        return Game.armyManager.banish(user, data.units);
    }

    async _unitReserve(user, data) {
        return Game.armyManager.sendToReserve(user, data.units);
    }

    async _expandArmyInventory(user, data) {
        if (data.byItem) {
            return Game.armyManager.expandSlots(user)
        } else {
            return Game.armyManager.buySlotsExpansion(user)
        }
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

    // Shop
    async _purchase(user, data) {
        if (exist(data.iap)) {
            return Game.shop.purchase(user.id, data.iap, data.address, data.chain);
        } else if (exist(data.goldIndex)) {
            return Game.shop.purchaseGold(user.id, +data.goldIndex);
        } else if (exist(data.packId)) {
            return Game.shop.purchasePack(user.id, data.address, data.chain, +data.packId);
        }

        return Game.shop.purchaseSubscription(user.id, data.address, data.chain, +data.cardId);
    }

    async _purchaseStatus(user, data) {
        return Game.shop.paymentStatus(user.id);
    }

    async _purchaseDailyItem(user, data) {
        if (!isNumber(data.itemIndex)) {
            throw Errors.IncorrectArguments;
        }

        return user.dailyShop.purchase(+data.itemIndex, data.fixed);
    }

    async _refreshDailyShop(user, data) {
        return user.dailyShop.refresh();
    }

    // Simple Dungeon
    async _sDungeonGenerate(user, data) {
        return this.simpleDungeon.generateNewFloor(true);
    }

    async _sDungeonReveal(_, data) {
        if (!isNumber(data.cellId)) {
            throw Errors.IncorrectArguments;
        }

        return this.simpleDungeon.reveal(+data.cellId);
    }

    async _sDungeonUseCell(_, data) {
        return this.simpleDungeon.useCell(+data.cellId);
    }

    async _sDungeonLoad() {
        return this.simpleDungeon.load();
    }

    async _sDungeonCombatAction(_, data) {
        if (!isNumber(data.data.move)) {
            throw Errors.IncorrectArguments;
        }

        return this.simpleDungeon.combatAction(data.data.move);
    }

    async _sDungeonMove(_, data) {
        if (!isNumber(data.cellId)) {
            throw Errors.IncorrectArguments;
        }

        return this.simpleDungeon.moveTo(data.cellId);
    }

    async _sDungeonUseItem(_, data) {
        return this.simpleDungeon.useItem(data.item);
    }

    async _sDungeonNextFloor(_, data) {
        return this.simpleDungeon.nextFloor();
    }

    async _sDungeonTestAction(_, data) {
        return this.simpleDungeon.testAction(data.action);
    }

    async _sDungeonEquip(_, data) {
        const { mHand, oHand } = data;
        return this.simpleDungeon.equip(mHand, oHand);
    }

    async _sDungeonPath(_, data) {
        if (!isNumber(data.cellId)) {
            throw Errors.IncorrectArguments;
        }

        return this.simpleDungeon.estimateEnergy(data.cellId);
    }

    async _sDungeonRank(user, data) {
        if (data.personal) {
            return this.simpleDungeon.getRank();
        }

        if (!isNumber(data.page)) {
            throw Errors.IncorrectArguments;
        }

        if (data.total) {
            return Game.dungeonManager.totalPlayers();
        }

        return Game.dungeonManager.getRankings(data.page);
    }

    async _sDungeonEnter(_, data) {
        if (data.status) {
            return this.simpleDungeon.getEntranceStatus();
        }

        if (data.free) {
            this.simpleDungeon.enter(true, true);
            return;
        }

        return this.simpleDungeon.enter(false, false, data.chain, data.address);
    }

    async _sDungeonCommitStats(_, data) {
        if (!data.stats) {
            throw Errors.IncorrectArguments;
        }

        for (let key in data.stats) {
            if (!isNumber(data.stats[key])) {
                throw Errors.IncorrectArguments;
            }
        }

        return this.simpleDungeon.commitStats(data.stats);
    }

    // Xmas
    async _xmasLoad() {
        return this.xmas.load();
    }

    async _xmasFarmUpgrade(_, data) {
        if (!isNumber(data.tier)) {
            throw Errors.IncorrectArguments;
        }
        return this.xmas.farmUpgrade(data.tier);
    }

    async _xmasHarvest(_, data) {
        if (!isNumber(data.tier)) {
            throw Errors.IncorrectArguments;
        }
        return this.xmas.harvest(data.tier);
    }

    async _xmasCommitPerks(_, data) {
        if (!data.perks || !data.burstPerks) {
            throw Errors.IncorrectArguments;
        }
        return this.xmas.commitPerks(data);
    }

    async _xmasUpdateLevelGap(_, data) {
        if (!isNumber(data.value)) {
            throw Errors.IncorrectArguments;
        }
        return this.xmas.updateLevelGap(data.value);
    }

    async _xmasXmasActivatePerk(_, data) {
        if (!data.currency || !data.tier || !data.perkName) {
            throw Errors.IncorrectArguments;
        }
        return this.xmas.activatePerk(data);
    }

    async _xmasXmasCommitSlotPerks(_, data) {
        if (!data.slotPerks || !data.tier) {
            throw Errors.IncorrectArguments;
        }
        return this.xmas.commitSlotPerks(data);
    }

    async _xmasXmasRebalancePerks(_, data) {
        return this.xmas.rebalancePerks(data);
    }

    async _xmasCPointsStatus() {
        return Game.xmasManager.cpoints.getLatestState();
    }

    async _sDungeonWithdrwa(_, data) {
        if (typeof data.to !== 'string') {
            throw Errors.IncorrectArguments;
        }

        return this.simpleDungeon.withdrawReward(data.to);
    }

    // Lunar
    async _lunarLoad() {
        return this.lunar.load();
    }

    async _lunarCraft(_, items) {
        return this.lunar.craft(items);
    }

    async _lunarExchange(_, items) {
        return this.lunar.exchange(items);
    }

    async _lunarCollectDailyReward() {
        return this.lunar.collectDailyLunarReward();
    }

    async _lunarTestAction(_, data) {
        return this.lunar.testAction(data.action);
    }

    async _lunarPurchase(_, data) {
        if (data.shopIndex === undefined || data.shopIndex === null || !data.itemsCount || !data.currency) {
            throw Errors.IncorrectArguments;
        }
        return this.lunar.purchase(data.shopIndex, data.itemsCount, data.currency);
    }

    // March
    async _marchLoad() {
        return this.march.load();
    }

    async _marchStartNewGame(_, data) {
        if (!isNumber(data.petClass) ||
            !isNumber(data.level) ||
            !data.boosters ||
            !isNumber(data.boosters.maxHealth) ||
            !isNumber(data.boosters.extraLife) ||
            !isNumber(data.boosters.key)
        ) {
            throw Errors.IncorrectArguments;
        }
        return this.march.startNewGame(data.petClass, data.level, data.boosters);
    }

    async _marchExitGame() {
        return this.march.exitGame();
    }

    async _marchGameOver() {
        return this.march.gameOver();
    }

    async _marchTouch(_, index) {
        return this.march.touch(index);
    }

    async _marchCollectDailyReward() {
        return this.march.collectDailyReward();
    }

    async _marchTestAction(_, data) {
        return this.march.testAction(data.action);
    }

    async _marchUnlockPet(_, data) {
        if (!isNumber(data.petClass)) {
            throw Errors.IncorrectArguments;
        }
        return this.march.unlockPet(data.petClass);
    }

    async _marchUpgradePet(_, data) {
        if (!isNumber(data.petClass)) {
            throw Errors.IncorrectArguments;
        }
        return this.march.upgradePet(data.petClass);
    }

    async _marchOpenChest(_, data) {
        if (!isNumber(data.keyNumber)) {
            throw Errors.IncorrectArguments;
        }
        return this.march.tryToOpenChest(data.keyNumber);
    }

    async _marchRanking(user, data) {
        return {
            rankings: await Game.marchManager.getRankings(),
            hasRewards: await Game.marchManager.userHasRewards(user),
            timeLeft: Game.marchManager.timeLeft,
        };
    }

    async _marchClaimRewards(user, data) {
        return this.march.claimRewards();
    }

    async _marchPurchaseGold(user, data) {
        if (!isNumber(data.shopIndex) ||
            !['hard', 'dkt'].includes(data.currency)
        ) {
            throw Errors.IncorrectArguments;
        }

        if (!isString(data.currency) && ['hard', 'dkt'].includes(data.currency)) {
            throw Errors.IncorrectArguments;
        }

        return this.march.purchaseGold(data.shopIndex, data.currency);
    }

    // April
    async _aprilLoad() {
        return this.april.load();
    }

    async _aprilClaimReward(user, { type, heroClass }) {
        return this.april.claimReward(type, heroClass);
    }

    async _aprilRankings(user, data) {
        return {
            rankings: await Game.aprilManager.getRankings(),
            hasRewards: await Game.aprilManager.userHasRewards(user),
            resetTimeLeft: Game.aprilManager.resetTimeLeft,
            timeLeft: Game.aprilManager.timeLeft,
        };
    }

    async _aprilHeroStat(user, data) {
        return this.april.heroStat();
    }

    async _aprilPurchaseHero(user, heroClass) {
        if (!isString(heroClass)) {
            throw Errors.IncorrectArguments;
        }
        return this.april.purchaseHero(heroClass);
    }

    async _aprilPurchaseTicket(user, data) {
        return this.april.purchaseTicket();
    }

    async _aprilPurchaseGold(user, data) {
        if (!isNumber(data.shopIndex) ||
            !['hard', 'dkt'].includes(data.currency)
        ) {
            throw Errors.IncorrectArguments;
        }

        if (!isString(data.currency) && ['hard', 'dkt'].includes(data.currency)) {
            throw Errors.IncorrectArguments;
        }

        return this.april.purchaseGold(data.shopIndex, data.currency);
    }

    async _aprilRestart(user, heroClass) {
        if (!isString(heroClass)) {
            throw Errors.IncorrectArguments;
        }
        return this.april.restart(heroClass);
    }

    async _aprilMove(user, data) {
        if (!isString(data.cardId)) {
            throw Errors.IncorrectArguments;
        }
        if (!isNumber(data.index)) {
            throw Errors.IncorrectArguments;
        }
        return this.april.move(data.cardId, data.index);
    }

    async _aprilSkip() {
        return this.april.skip();
    }

    async _aprilPurchaseAction() {
        return this.april.purchaseAction();
    }

    async _aprilEnterLevel(user, booster) {
        if (!isString(booster)) {
            throw Errors.IncorrectArguments;
        }
        return this.april.enterLevel(booster);
    }

    async _aprilResurrect() {
        return this.april.resurrect();
    }

    async _aprilTestAction(_, data) {
        return this.april.testAction(data.action);
    }

    async _aprilExit() {
        return this.april.exit();
    }

    // Battle
    async _battleLoad() {
      return this.battle.load();
    }

    async _battleClaimReward(_, { type }) {
      return this.battle.claimReward(type);
    }

    async _battlePurchase(_, { commodity, currency, shopIndex }) {
      return this.battle.purchase(commodity, currency, shopIndex);
    }
    
    async _battleFillSquadSlot(_, { unitId, index }) {
      return this.battle.fillSquadSlot(unitId, index);
    }
    
    async _battleClearSquadSlot(_, { index }) {
      return this.battle.clearSquadSlot(index);
    }
    
    async _battleUpgradeUnitLevel(_, { unitId }) {
      return this.battle.upgradeUnitLevel(unitId);
    }
    
    async _battleUpgradeUnitAbility(_, { unitId, ability }) {
      return this.battle.upgradeUnitAbility(unitId, ability);
    }
    
    async _battleApply(_, { unitId, index, ability }) {
      return this.battle.apply(unitId, index, ability);
    }
    
    async _battleSkip() {
      return this.battle.skip();
    }
    
    async _battleEnterLevel(_, { room, level }) {
      return this.battle.enterLevel(room, level);
    }

    async _battleEnterDuel(_, { difficulty }) {
      return this.battle.enterDuel(difficulty);
    }

    async _battleFetchDuelOptions(_) {
      return this.battle.getDuelOptions();
    }

    async _battleRankings() {
      return Game.battleManager.getRankings();
    }

    async _battleRestart() {
      return this.battle.restart();
    }
    
    async _battleExit() {
      return this.battle.exit();
    }
    
    async _battleTestAction(_, data) {
      return this.battle.testAction(data);
    }
}

module.exports = PlayerController;