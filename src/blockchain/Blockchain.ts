import { IBlockchain } from "./IBlockchain";
import { createBlockchain } from "./blockchainFactory";
import { Db } from "mongodb";
import Blockchains from "../knightlands-shared/blockchains";

export interface PurchaseData {
    divs: string;
}

export interface DivsWithdrawalData {
    user: string;
    amount: string;
    withdrawalId: string;
}

export class Blockchain {
    private _blockchains: { [key: string]: IBlockchain };

    public static get Payment() {
        return "__payment_block__";
    }

    public static get TransactionFailed() {
        return "__tx_failed__";
    }

    public static get DividendTokenWithdrawal() {
        return "__div_token_withdrawal__";
    }

    public static get DividendWithdrawal() {
        return "__divs_withdrawal__";
    }

    public static get TokenWithdrawal() {
        return "__token_withdrawal__";
    }

    constructor(db: Db) {
        this._blockchains = {};
        this._blockchains[Blockchains.Ethereum] = createBlockchain(Blockchains.Ethereum, db);
    }

    async start() {
        for (const id in this._blockchains) {
            await this._blockchains[id].start()
        }
    }

    getBlockchain(id: string) {
        return this._blockchains[id];
    }

    async on(evt: string, cb: (...args) => void) {
        for (const id in this._blockchains) {
            this._blockchains[id].on(evt, (data: any) => {
                cb(id, data);
            });
        }
    }
}
