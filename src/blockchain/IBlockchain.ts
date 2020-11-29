import { string } from "random-js"

import { EventEmitter } from "events";

export interface IBlockchain extends EventEmitter {
    verifySign(nonce, message, address): Promise<boolean>;
    sign(...args): Promise<string>;
    sendTransaction(signedTransaction): Promise<string>;
    scanEvents(): Promise<void>;
    start(): Promise<void>;
    isAddress(addr: string): boolean;
    getBigIntDivTokenAmount(amount: number): string;
    getPaymentNonce(wallet: string): Promise<number>;
}
