import Game from "../game";
import { Collections } from "../database/database";
import { DailyShopSaveData, DailyShopMeta, DailyShopEntry } from "./Types";
import WeightedList from "../js-weighted-list";
import Errors from "../knightlands-shared/errors";

export class DailyShop {
    private _user: any;
    private _data: DailyShopSaveData;
    private _meta: DailyShopMeta;

    constructor(data: DailyShopSaveData, user) {
        this._user = user;
        this._data = data;

        if (!this._data.singlePurchases) {
            this._data.singlePurchases = {};
        }
    }

    async update() {
        const currentCycle = Math.floor(Game.nowSec / 86400);

        if (this._data.cycle != currentCycle) {
            this._data.cycle = currentCycle;

            if (currentCycle % 7 == 0 || !this._data.weeklyPurchases) {
                this._data.weeklyPurchases = {};
            }

            this._data.refreshes = 0;
            this._data.purchasedItems = {};
            this._data.fixedItems = {};
            this._data.dailyPurchases = {};

            await this._refreshItems();
        }
    }

    isPurchasedOnce(packId: number) {
        return !!this._data.singlePurchases[packId];
    }

    setPurchased(packId: number) {
        this._data.singlePurchases[packId] = 1;
    }

    timesPurchased(packId: number, daily: boolean) {
        if (daily) {
            return this._data.dailyPurchases[packId] || 0;
        }
        return this._data.weeklyPurchases[packId] || 0;
    }

    incPurchase(packId: number, daily: boolean) {
        if (daily) {
            this._data.dailyPurchases[packId] = (this._data.dailyPurchases[packId] || 0) + 1;
        } else {
            this._data.weeklyPurchases[packId] = (this._data.weeklyPurchases[packId] || 0) + 1;
        }
    }

    async purchase(itemIndex: number, fixed: boolean = false) {
        if (itemIndex < 0) {
            throw Errors.IncorrectArguments;
        }

        const meta = await this._getMeta();
        let item;
        if (fixed) {
            if (meta.fixedItems.length <= itemIndex) {
                throw Errors.IncorrectArguments;
            }

            item = meta.fixedItems[itemIndex].data;
        } else {
            if (this._data.items.length <= itemIndex) {
                throw Errors.IncorrectArguments;
            }

            item = this._data.items[itemIndex];
        }

        const purchaseData = fixed ? this._data.fixedItems : this._data.purchasedItems;
        if (purchaseData[item.item] >= item.max) {
            throw Errors.IncorrectArguments;
        }

        if (item.soft > 0) {
            if (this._user.softCurrency < item.soft) {
                throw Errors.NotEnoughSoft;
            } else {
                await this._user.addSoftCurrency(-item.soft);
            }
        }

        if (item.hard > 0) {
            if (this._user.hardCurrency < item.hard) {
                throw Errors.NotEnoughSoft;
            } else {
                await this._user.addHardCurrency(-item.hard);
            }
        }

        purchaseData[item.item] = (purchaseData[item.item] || 0) + 1;
        await this._user.inventory.addItemTemplate(item.item, item.count);

        return {
            item: item.item,
            quantity: item.count
        }
    }

    async refresh() {
        const meta = await this._getMeta();
        let priceIndex = this._data.refreshes;
        const price = meta.refreshPrice[priceIndex];

        if (this._user.hardCurrency < price) {
            throw Errors.NotEnoughCurrency;
        }

        priceIndex++;
        if (priceIndex >= meta.refreshPrice.length) {
            priceIndex = meta.refreshPrice.length - 1;
        }
        this._data.refreshes = priceIndex;

        await this._user.addHardCurrency(-price);
        await this._refreshItems();
    }

    private async _getMeta() {
        if (!this._meta) {
            this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "daily_shop" });
        }

        return this._meta;
    }

    private async _refreshItems() {
        const meta = await this._getMeta();
        const itemsList = new WeightedList(meta.items);

        this._data.items = itemsList.peek(meta.maxItems, false).map(x => x.data as DailyShopEntry);
    }
}
