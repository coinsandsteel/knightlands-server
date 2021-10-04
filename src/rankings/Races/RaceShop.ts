import { RaceShopConfiguration } from "./RaceTypes";
import Errors from "../../knightlands-shared/errors";
import CurrencyType from "../../knightlands-shared/currency_type";
import User from "../../user";

export class RaceShop {
    private _meta: RaceShopConfiguration;

    constructor(meta: RaceShopConfiguration) {
        this._meta = meta;
    }

    getMax(lotId: number) {
        return this._meta.items[lotId].max;
    }

    async purchaseItem(user: User, lotId: number) {
        const lot = this._meta.items[lotId];
        if (!lot) {
            throw Errors.UnknownLot;
        }

        if (user.inventory.getCurrency(CurrencyType.RaceChips) < lot.price) {
            throw Errors.NotEnoughCurrency;
        }

        await user.inventory.modifyCurrency(CurrencyType.RaceChips, -lot.price);
        await user.inventory.addItemTemplate(lot.item, lot.quantity);
    }
}