import { InferencePriority } from "typescript";

export interface ShiniesTopUp {
    iap: string;
    shinies: number;
}

export interface RaidTicketsTopUp {
    iap: string;
    tickets: number;
}

export interface TopUpShopMeta {
    shinies: ShiniesTopUp[];
    raidTickets: RaidTicketsTopUp[];
    firstPurchaseBonus: number;
    raidTicket: number;
}
