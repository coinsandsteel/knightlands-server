import { RaceShopConfiguration } from "./RaceTypes";
import Errors from "../../knightlands-shared/errors";
import CurrencyType from "../../knightlands-shared/currency_type";
import User from "../../user";
import Game from "../../game";

interface RaceShopSaveData {
    dailyPurchases: { [key: string]: number }
}

export class RaceShopUser {
    private _user: User;
    private _data: RaceShopSaveData;

    constructor(data: RaceShopSaveData, user: User) {
        this._user = user;

        if (!data.dailyPurchases) {
            data.dailyPurchases = {};
        }

        this._data = data;
    }

    reset() {
        this._data.dailyPurchases = {};
    }

    async purchase(lotId: number) {
        const total = this._data.dailyPurchases[lotId] || 0;
        if (Game.rankings.races.shop.getMax(lotId) <= total) {
            throw Errors.IncorrectArguments;
        }

        await Game.rankings.races.shop.purchaseItem(this._user, lotId);
        this._data.dailyPurchases[lotId] = total + 1;
    }
}