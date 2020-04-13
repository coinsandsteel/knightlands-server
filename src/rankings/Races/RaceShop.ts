import { RaceShopConfiguration } from "./RaceTypes";
import Errors from "../../knightlands-shared/errors";
import CurrencyType from "../../knightlands-shared/currency_type";

export class RaceShop {
    private _meta: RaceShopConfiguration;

    constructor(meta: RaceShopConfiguration) {
        this._meta = meta;
    }

    async purchaseItem(user: any, lotId: number) {
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