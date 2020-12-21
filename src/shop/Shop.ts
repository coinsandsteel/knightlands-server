import Game from "../game";
import { Collections } from "../database";
import { ShiniesTopUp, RaidTicketsTopUp, TopUpShopMeta } from "./Types";
import Errors from "../knightlands-shared/errors";
const Events = require("../knightlands-shared/events");

export class Shop {
    private IapTag: string = "IapTag";

    private _topUpMeta: TopUpShopMeta;
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
            return await this._paymentProcessor.requestPayment(
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

    private async _registerTopUpIaps(iapExecutor: any) {
        let topUpShop = await this._getTopUpMeta();

        topUpShop.shinies.forEach((shiniesRecord: ShiniesTopUp) => {
            iapExecutor.registerAction(shiniesRecord.iap, async context => {
                return await this._topUpShines(context.iap, context.userId, shiniesRecord.shinies);
            });

            iapExecutor.mapIAPtoEvent(shiniesRecord.iap, Events.PurchaseComplete);
        });

        // topUpShop.raidTickets.
    }

    private async _topUpShines(iap: string, userId: string, amount: number) {
        console.log(iap, userId, amount);

        const user = await Game.getUser(userId);

        if (!user.isPurchased(iap)) {
            const meta = await this._getTopUpMeta();
            amount *= (1 + meta.firstPurchaseBonus);
            user.setPurchased(iap);
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
