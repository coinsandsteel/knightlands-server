import { string } from "random-js"

import { EventEmitter } from "events";

export interface IBlockchain extends EventEmitter {
    verifySign(nonce, message, address): Promise<boolean>;
    sign(...args): Promise<string>;
    sendTransaction(signedTransaction): Promise<string>;
    scanEvents(): Promise<void>;
    start(): Promise<void>;
    isAddress(addr: string): boolean;
    getBigIntDivTokenAmount(amount: number): bigint;
    getPaymentNonce(wallet: string): Promise<number>;
    getTokenNonce(wallet: string, type: string): Promise<number>;
    getTokenAddress(currency): string;
    convertTokenAmount(amount: string): number;
}
