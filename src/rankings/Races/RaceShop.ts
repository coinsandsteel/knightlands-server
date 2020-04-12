import { Collection } from "mongodb";

export class RaceShop {
    _collection: Collection;

    constructor(collection: Collection) {
        this._collection = collection;
    }

    async init() {
        
    }
}