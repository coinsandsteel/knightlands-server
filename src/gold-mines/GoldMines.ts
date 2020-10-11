import Game from '../game';
import Errors from '../knightlands-shared/errors';
import { GoldMinesMeta, GoldMine, GoldMinesSaveData } from './types';
import { Collections } from '../database';

export class GoldMines {
    private data: GoldMinesSaveData;
    private meta: GoldMinesMeta;
    private user: any;

    constructor(user: any, data: GoldMinesSaveData) {
        this.data = data;
        this.user = user;

        if (!this.data.mines) {
            this.data.mines = [
                this.createMine()
            ];
        }
    }

    async collectGold(mineIndex: number) {
        const mine = this.checkAndGetMine(mineIndex);

        await this.updateMine(mine);

        const collectedGold = Math.floor(mine.gold); // floating point accumulation
        await this.user.addSoftCurrency(collectedGold);

        mine.gold -= collectedGold;
    }

    async upgradeMine(mineIndex: number) {
        const mine = this.checkAndGetMine(mineIndex);
        const meta = await this.getMeta();

        if (meta.mines.length <= mine.level + 1) {
            throw Errors.GoldMineMaxLevel;
        }

        const price = meta.mines[mine.level + 1].price;
        if (this.user.softCurrency < price) {
            throw Errors.NotEnoughSoft;
        }

        await this.user.addSoftCurrency(-price);
        await this.updateMine(mine);

        mine.level++;
    }

    async upgradeStorage(mineIndex: number) {
        const mine = this.checkAndGetMine(mineIndex);
        const meta = await this.getMeta();

        if (meta.storage.length <= mine.storageLevel + 1) {
            throw Errors.GoldMineStorageMaxLevel;
        }

        const price = meta.mines[mine.storageLevel + 1].price;
        if (this.user.softCurrency < price) {
            throw Errors.NotEnoughSoft;
        }

        await this.user.addSoftCurrency(-price);
        await this.updateMine(mine);

        mine.storageLevel++;
    }

    async expand() {
        const meta = await this.getMeta();
        if (this.data.mines.length - 1 >= meta.addMines.length) {
            throw Errors.MaxMines;
        }

        const price = meta.addMines[this.data.mines.length - 1];
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
        const storageSize = meta.storage[mine.storageLevel].size;

        if (goldMined > storageSize) {
            goldMined = storageSize;
        }

        mine.gold += goldMined;
        mine.lastUpdate = Game.nowSec;
    }

    private createMine(): GoldMine {
        return {
            level: 0,
            storageLevel: 0,
            gold: 0,
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
