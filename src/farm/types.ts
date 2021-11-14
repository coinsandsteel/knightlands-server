// ENUMS

export const BoostID = {
    BOOST_1: 1,
    BOOST_2: 2,
    BOOST_3: 3,
    BOOST_4: 4,
    BOOST_5: 5,
    BOOST_6: 6
}

export const PassiveID = {
    PASSIVE_1: 1,
    PASSIVE_2: 2,
    PASSIVE_3: 3,
    PASSIVE_4: 4,
    PASSIVE_5: 5,
    PASSIVE_6: 6,
    PASSIVE_7: 7
}

export const FarmCurrencyID = {
    SB: 1,
    CP: 2
}


// STATE DATA 

export interface FarmState {
    builds: FarmBuildingState[];
}

export interface FarmBuildingState {
    lvl: number; // level
    lastUpd: number; // last update timestamp
}


// METADATA

export interface FarmMeta {
    buildings: FarmBuildingMeta[];
}

export interface FarmBuildingMeta {
    cycleLength: number;
    income: number;
    itemId: number;
    farmCurrency: number;
    price: number;
}