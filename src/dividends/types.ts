export interface DropRateEntry {
    price: number;
    rate: number;
}

export interface ShopEntry {
    item: number;
    quantity: number;
    price: number;
}

export interface DividendsMiningParameters {
    base: number;
    factor: number;
}

export interface DividendsMiningMeta {
    price: DividendsMiningParameters;
    rate: DividendsMiningParameters;
}

export interface DividendsMeta {
    mining: DividendsMiningMeta;
    dropRates: DropRateEntry[];
    shop: { [key: string]: ShopEntry }
}

export type PayoutsPerShare = { [key: string]: bigint };

export interface DividendsData {
    season: number;
    unlockedTokens: number;
    miningLevel: number;
    dropRateLevel: number;
    lastPayout: number;
    lastMiningUpdate: number;
    payouts: { [key: string]: string };
    claimed: { [key: string]: string };
    stake: number;
}
