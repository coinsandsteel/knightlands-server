import Game from '../game';
import Errors from '../knightlands-shared/errors';
import ItemProperties from '../knightlands-shared/item_properties';
import { GoldMinesMeta, GoldMine, GoldMinesSaveData } from './types';
import { Collections } from '../database/database';

export class GoldMines {
    private data: GoldMinesSaveData;
    private meta: GoldMinesMeta;
    private user: any;

    constructor(user: any, data: GoldMinesSaveData) {
        this.data = data;
        this.user = user;

        if (!this.data.mines) {
            this.data.storage = {
                level: 0,
                gold: 0
            };
            this.data.mines = [];
        }
    }

    async collectGold() {
        for (const mine of this.data.mines) {
            await this.updateMine(mine);
        }

        const collectedGold = Math.floor(this.data.storage.gold); // floating point accumulation
        await this.user.addSoftCurrency(collectedGold, true);

        this.data.storage.gold -= collectedGold;
    }

    async upgradeMine(mineIndex: number) {
        const mine = this.checkAndGetMine(mineIndex);
        const meta = await this.getMeta();

        if (meta.mines.length <= mine.level) {
            throw Errors.GoldMineMaxLevel;
        }

        let price = meta.mines[mine.level].price;

        // get price discount
        const discountItem = await this.user.inventory.getItemByTemplate(meta.priceCharm);
        if (discountItem) {
            const template = await Game.itemTemplates.getTemplate(discountItem.template);
            const prop = template.properties.find(x => x.type == ItemProperties.GoldMineUpgradeDiscount);
            if (prop) {
                price *= 1 - (discountItem.count * prop.value) / 100;
                price = Math.floor(price);
            }
        }

        if (this.user.softCurrency < price) {
            throw Errors.NotEnoughSoft;
        }

        await this.user.addSoftCurrency(-price);
        await this.updateMine(mine);

        mine.level++;
    }

    async upgradeStorage() {
        const meta = await this.getMeta();

        if (meta.storage.length <= this.data.storage.level) {
            throw Errors.GoldMineStorageMaxLevel;
        }

        const price = meta.storage[this.data.storage.level].price;
        if (this.user.softCurrency < price) {
            throw Errors.NotEnoughSoft;
        }

        await this.user.addSoftCurrency(-price);

        for (const mine of this.data.mines) {
            await this.updateMine(mine);
        }

        this.data.storage.level++;
    }

    async expand() {
        const meta = await this.getMeta();
        if (this.data.mines.length >= meta.addMines.length) {
            throw Errors.MaxMines;
        }

        const price = meta.addMines[this.data.mines.length];
        if (this.user.softCurrency < price) {
            throw Errors.NotEnoughSoft;
        }

        await this.user.addSoftCurrency(-price);
        this.data.mines.push(this.createMine());
    }

    private async updateMine(mine: GoldMine) {
        const meta = await this.getMeta();

        const timePassed = Game.nowSec - mine.lastUpdate;
        let goldMined = timePassed * meta.mines[mine.level].rate;

        this.data.storage.gold += goldMined;

        const storageSize = meta.storage[this.data.storage.level].size;
        if (this.data.storage.gold > storageSize) {
            this.data.storage.gold = storageSize;
        }

        mine.lastUpdate = Game.nowSec;
    }

    private createMine(): GoldMine {
        return {
            level: 0,
            lastUpdate: Game.nowSec
        }
    }

    private async getMeta() {
        if (!this.meta) {
            this.meta = await Game.db.collection(Collections.Meta).findOne({ _id: "mines_meta" });
        }

        return this.meta;
    }

    private checkAndGetMine(mineIndex: number): GoldMine {
        if (Number.isNaN(mineIndex) || mineIndex < 0 || this.data.mines.length <= mineIndex) {
            throw Errors.IncorrectArguments;
        }

        return this.data.mines[mineIndex];
    }
}
