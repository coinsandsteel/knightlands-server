import Game from "../game";
import { Collections } from "../database";
import { ShiniesTopUp, RaidTicketsTopUp, TopUpShopMeta, PremiumShopMeta, PackMeta } from "./Types";
import Errors from "../knightlands-shared/errors";
const Events = require("../knightlands-shared/events");

export class Shop {
    private IapTag: string = "IapTag";

    private _topUpMeta: TopUpShopMeta;
    private _premiumMeta: PremiumShopMeta;
    private _paymentProcessor: any;

    constructor(paymentProcessor: any) {
        this._paymentProcessor = paymentProcessor;
    }

    async init(iapExecutor: any) {
        await this._registerTopUpIaps(iapExecutor);
    }

    async paymentStatus(userId: string) {
        return this._paymentProcessor.fetchPaymentStatus(userId, this.IapTag, {
            "context.userId": userId
        });
    }

    async purchasePack(userId: string, address: string, packId: number) {
        const meta = await this._getPremiumMeta();

        const pack = meta.packs.find(p => p.id == packId);
        if (!pack) {
            throw Errors.IncorrectArguments;
        }

        const user = await Game.getUser(userId);

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
            return this._claimPack(pack, userId);
        }

        return this.purchase(userId, pack.iap, address);
    }

    async purchaseGold(userId: string, goldIndex: number) {
        const meta = await this._getTopUpMeta();

        if (isNaN(goldIndex) || goldIndex < 0 || goldIndex >= meta.gold.length) {
            throw Errors.IncorrectArguments;
        }

        const user = await Game.getUser(userId);

        const goldLot = meta.gold[goldIndex];

        if (user.hardCurrency < goldLot.price) {
            throw Errors.NotEnoughCurrency;
        }

        await user.addHardCurrency(-goldLot.price);
        await user.addSoftCurrency(goldLot.amount);

        return goldLot.amount;
    }

    async purchase(userId: string, iap: string, address: string) {
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
                address
            );
        } catch (exc) {
            throw exc;
        }
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

    private async _registerTopUpIaps(iapExecutor: any) {
        const topUpShop = await this._getTopUpMeta();

        topUpShop.shinies.forEach((shiniesRecord: ShiniesTopUp) => {
            iapExecutor.registerAction(shiniesRecord.iap, async context => {
                return this._topUpShines(context.iap, context.userId, shiniesRecord.shinies);
            });

            iapExecutor.mapIAPtoEvent(shiniesRecord.iap, Events.PurchaseComplete);
        });

        // topUpShop.raidTickets.

        const premiumMeta = await this._getPremiumMeta();
        premiumMeta.packs.forEach(pack => {
            iapExecutor.registerAction(pack.iap, async context => {
                return this._claimPack(pack, context.userId);
            });

            iapExecutor.mapIAPtoEvent(pack.iap, Events.PurchaseComplete);
        });
    }

    private async _claimPack(pack: PackMeta, userId: string) {
        const user = await Game.getUser(userId);

        if (pack.max) {
            user.dailyShop.setPurchased(pack.id);
        }

        if (pack.dailyMax) {
            user.dailyShop.incPurchase(pack.id, true);
        }

        if (pack.weeklyMax) {
            user.dailyShop.incPurchase(pack.id, false);
        }

        const items = await Game.lootGenerator.getLootFromTable(pack.loot);
        await user.inventory.autoCommitChanges(async () => {
            await user.inventory.addItemTemplates(items);
        });

        return items;
    }

    private async _topUpShines(iap: string, userId: string, amount: number) {
        const user = await Game.getUser(userId);

        if (!user.dailyShop.isPurchasedOnce(iap)) {
            const meta = await this._getTopUpMeta();
            amount *= (1 + meta.firstPurchaseBonus);
            user.dailyShop.setPurchased(iap);
        }

        await user.autoCommitChanges(async () => {
            await user.addHardCurrency(amount);
        });

        return {
            iap,
            amount
        };
    }
}
