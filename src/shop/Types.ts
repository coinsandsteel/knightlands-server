export interface ShiniesTopUp {
    iap: string;
    shinies: number;
}

export interface GoldTopUp {
    price: number;
    amount: number;
}

export interface RaidTicketsTopUp {
    iap: string;
    tickets: number;
}

export interface TopUpShopMeta {
    shinies: ShiniesTopUp[];
    gold: GoldTopUp[];
    raidTickets: RaidTicketsTopUp[];
    firstPurchaseBonus: number;
    raidTicket: number;
}

export interface DailyShopEntryMeta {
    item: number;
    count: number;
    max: number;
    soft: number;
    hard: number;
    weight: number;
}

export interface DailyShopEntry {
    item: number;
    count: number;
    max: number;
    soft: number;
    hard: number;
}

export interface DailyShopSaveData {
    cycle: number;
    refreshes: number;
    purchasedItems: { [key: string]: number };
    dailyPurchases: { [key: string]: number };
    weeklyPurchases: { [key: string]: number };
    singlePurchases: { [key: string]: number };
    items: DailyShopEntry[];
}

export interface DailyShopMeta {
    items: DailyShopEntryMeta[];
    maxItems: number;
    refreshPrice: number[];
}

export interface PackMeta {
    id: number;
    price: number;
    iap: string;
    max: number;
    dailyMax: number;
    weeklyMax: number;
    loot: any;
}

export interface PremiumShopMeta {
    packs: PackMeta[];
}
