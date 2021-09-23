import { IBlockchain } from "./IBlockchain";
import { createBlockchain } from "./blockchainFactory";
import { Db } from "mongodb";
import Blockchains from "../knightlands-shared/blockchains";

export interface PurchaseData {
    divs: string;
}

export interface DivsWithdrawalData {
    to: string;
    amount: string;
    withdrawalId: string;
    transactionHash: string;
}

export interface TokenWithdrawalData {
    to: string;
    amount: string;
    withdrawalId: string;
    transactionHash: string;
    token: string;
    currency?: string;
}

export interface Withdrawal {
    to: string;
    amount: string;
    transactionHash?: string;
    token: string;
    chain: string;
    user: string;
    date: number;
    nonce: number;
    pending: boolean;
    currency: string;
    deadline: number;
}

export interface TokenDepositData {
    currency?: string;
    depositorId: string;
    token: string;
    from: string;
    amount: string;
    blockNumber: number;
    transactionHash: string;
}

export interface PresaleCardDepositData {
    to: string;
    amount: string;
    tokenIds: string[];
    depositId: string;
    blockNumber: number;
    transactionHash: string;
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

    public static get BurntTokenWithdrawal() {
        return "__div2_token_withdrawal__";
    }

    public static get DividendWithdrawal() {
        return "__divs_withdrawal__";
    }

    public static get TokenWithdrawal() {
        return "__token_withdrawal__";
    }

    public static get TokenDeposit() {
        return "__token_deposit__";
    }

    public static get PresaleCardDeposit() {
        return "__presale_card_deposit__";
    }

    constructor(db: Db) {
        this._blockchains = {};
        this._blockchains[Blockchains.Ethereum] = createBlockchain(Blockchains.Ethereum, db);
        // this._blockchains[Blockchains.Polygon] = createBlockchain(Blockchains.Polygon, db);
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
