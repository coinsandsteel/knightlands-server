import Game from "../game";
import { Collections } from "../database/database";
import { TopUpShopMeta, PremiumShopMeta, PackMeta, SubscriptionsShopMeta, SubscriptionMeta } from "./Types";
import Errors from "../knightlands-shared/errors";
import { ObjectId } from "mongodb";

const Events = require("../knightlands-shared/events");

export class Shop {
    private IapTag: string = "IapTag";

    private _topUpMeta: TopUpShopMeta;
    private _premiumMeta: PremiumShopMeta;
    private _subscriptionMeta: SubscriptionsShopMeta;
    private _paymentProcessor: any;

    constructor(paymentProcessor: any) {
        this._paymentProcessor = paymentProcessor;
    }

    async init(iapExecutor: any) {
        await this._registerIaps(iapExecutor);
    }

    async getCardMeta(cardId: number): Promise<SubscriptionMeta> {
        const meta = await this._getSubscriptionsMeta();
        return meta.cards[cardId];
    }

    async paymentStatus(userId: ObjectId) {
        return this._paymentProcessor.fetchPaymentStatus(userId, this.IapTag, {
            "context.userId": userId
        });
    }

    async purchaseSubscription(userId: ObjectId, address: string, chain: string, cardId: number) {
        const meta = await this._getSubscriptionsMeta();
        const cardMeta = meta.cards[cardId];

        if (!cardMeta) {
            throw Errors.UnknownIap;
        }

        if (!cardMeta.iap) {
            throw Errors.UnknownIap;
        }

        return this.purchase(userId, cardMeta.iap, address, chain)
    }

    async purchasePack(userId: ObjectId, address: string, chain: string, packId: number) {
        const meta = await this._getPremiumMeta();

        const pack = meta.packs.find(p => p.id == packId);
        if (!pack) {
            throw Errors.IncorrectArguments;
        }

        const user = await Game.getUserById(userId);
        if (pack.max) {
            if (user.dailyShop.isPurchasedOnce(pack.id)) {
                throw Errors.AlreadyPurchased;
            }
        }

        if (pack.dailyMax) {
            if (user.dailyShop.timesPurchased(pack.id, true) >= pack.dailyMax) {
                throw Errors.AlreadyPurchased;
            }
        }

        if (pack.weeklyMax) {
            if (user.dailyShop.timesPurchased(pack.id, false) >= pack.weeklyMax) {
                throw Errors.AlreadyPurchased;
            }
        }

        if (pack.price) {
            if (user.hardCurrency < pack.price) {
                throw Errors.NotEnoughCurrency;
            }

            await user.addHardCurrency(-pack.price);
            return this._claimPack(pack, user.id);
        }

        return this.purchase(user.id, pack.iap, address, chain);
    }

    async purchaseGold(userId: ObjectId, goldIndex: number) {
        const meta = await this._getTopUpMeta();

        if (isNaN(goldIndex) || goldIndex < 0 || goldIndex >= meta.gold.length) {
            throw Errors.IncorrectArguments;
        }

        const user = await Game.getUserById(userId);
        const goldLot = meta.gold[goldIndex];

        if (user.hardCurrency < goldLot.price) {
            throw Errors.NotEnoughCurrency;
        }

        await user.addHardCurrency(-goldLot.price);
        await user.addSoftCurrency(goldLot.amount, true);

        return goldLot.amount;
    }

    async purchase(userId: ObjectId, iap: string, address: string, chain: string) {
        let iapContext = {
            userId,
            iap
        };

        // check if payment request already created
        let hasPendingPayment = await this._paymentProcessor.hasPendingRequestByContext(userId, iapContext, this.IapTag);
        if (hasPendingPayment) {
            throw Errors.PaymentInProgress;
        }

        try {
            return this._paymentProcessor.requestPayment(
                userId,
                iap,
                this.IapTag,
                iapContext,
                address,
                chain
            );
        } catch (exc) {
            throw exc;
        }
    }

    private async _getSubscriptionsMeta() {
        if (!this._subscriptionMeta) {
            this._subscriptionMeta = await Game.db.collection(Collections.Meta).findOne({ _id: "subscriptions" });;
        }

        return this._subscriptionMeta;
    }

    private async _getTopUpMeta() {
        if (!this._topUpMeta) {
            this._topUpMeta = await Game.db.collection(Collections.Meta).findOne({ _id: "top_up_shop" });;
        }

        return this._topUpMeta;
    }

    private async _getPremiumMeta() {
        if (!this._premiumMeta) {
            this._premiumMeta = await Game.db.collection(Collections.Meta).findOne({ _id: "premium_shop" });;
        }

        return this._premiumMeta;
    }

    private async _claimSubscription(card: SubscriptionMeta, userId: ObjectId) {
        const user = await Game.getUserById(userId);

        const result = {
            hard: 0,
            soft: 0
        };

        await user.autoCommitChanges(async () => {
            const cards = user.cards;
            let cardData = cards[card.id];

            if (!cardData || cardData.end < Game.nowSec) {
                cardData = {
                    end: Game.nowSec
                };

                cards[card.id] = cardData;

                // when bought first time - add attempts immediately
                user.applyBonusRefills(
                    card.towerAttempts,
                    card.armourTrialAttempts,
                    card.weaponTrialAttempts,
                    card.accessoryTrialAttempts
                );

                user.subscriptions.lastClaimCycle = user.getDailyRewardCycle();
            }

            cardData.end += card.duration;

            if (card.initialHard) {
                result.hard = card.initialHard + card.dailyHard;
                await user.addHardCurrency(result.hard);
            }

            if (card.initialSoft) {
                result.soft = card.initialSoft + card.dailySoft;
                await user.addSoftCurrency(result.soft);
            }
        });

        return result;
    }

    private async _registerIaps(iapExecutor: any) {
        const topUpShop = await this._getTopUpMeta();
        topUpShop.shinies.forEach(shiniesRecord => {
            iapExecutor.registerAction(shiniesRecord.iap, async context => {
                return this._topUpShines(context.iap, context.userId, shiniesRecord.shinies);
            });

            iapExecutor.mapIAPtoEvent(shiniesRecord.iap, Events.PurchaseComplete);
        });

        topUpShop.raidTickets.forEach(raidTicket => {
            iapExecutor.registerAction(raidTicket.iap, async context => {
                return this._topUpRaidTickets(context.iap, context.userId, raidTicket.tickets);
            });

            iapExecutor.mapIAPtoEvent(raidTicket.iap, Events.PurchaseComplete);
        });

        const premiumMeta = await this._getPremiumMeta();
        premiumMeta.packs.forEach(pack => {
            iapExecutor.registerAction(pack.iap, async context => {
                return this._claimPack(pack, context.userId);
            });

            iapExecutor.mapIAPtoEvent(pack.iap, Events.PurchaseComplete);
        });

        const subscriptionMeta = await this._getSubscriptionsMeta();
        for (const id in subscriptionMeta.cards) {
            const card = subscriptionMeta.cards[id];

            if (!card.iap) {
                continue;
            }

            iapExecutor.registerAction(card.iap, async context => {
                return this._claimSubscription(card, context.userId);
            });

            iapExecutor.mapIAPtoEvent(card.iap, Events.PurchaseComplete);
        }
    }

    private async _claimPack(pack: PackMeta, userId: ObjectId) {
        const user = await Game.getUserById(userId);
        const items = await Game.lootGenerator.getLootFromTable(pack.loot);

        await user.autoCommitChanges(async () => {
            if (pack.max) {
                user.dailyShop.setPurchased(pack.id);
            }

            if (pack.dailyMax) {
                user.dailyShop.incPurchase(pack.id, true);
            }

            if (pack.weeklyMax) {
                user.dailyShop.incPurchase(pack.id, false);
            }

            await user.inventory.addItemTemplates(items);
        });

        return items;
    }

    private async _topUpRaidTickets(iap: string, userId: ObjectId, amount: number) {
        const user = await Game.getUserById(userId);
        const meta = await this._getTopUpMeta();

        await user.autoCommitChanges(async () => {
            if (!user.dailyShop.isPurchasedOnce(iap)) {
                amount *= (1 + meta.firstPurchaseBonus);
                user.dailyShop.setPurchased(iap);
            }

            if (!user.dailyShop.isPurchasedOnce(iap)) {
                amount *= (1 + meta.firstPurchaseBonus);
                user.dailyShop.setPurchased(iap);
            }
            await user.inventory.addItemTemplate(meta.raidTicket, amount);
        });


        return {
            item: meta.raidTicket,
            quantity: amount
        };
    }

    private async _topUpShines(iap: string, userId: ObjectId, amount: number) {
        const user = await Game.getUserById(userId);

        await user.autoCommitChanges(async () => {
            if (!user.dailyShop.isPurchasedOnce(iap)) {
                const meta = await this._getTopUpMeta();
                amount *= (1 + meta.firstPurchaseBonus);
                user.dailyShop.setPurchased(iap);
            }

            await user.addHardCurrency(amount);
        });

        return {
            iap,
            hard: amount
        };
    }
}
