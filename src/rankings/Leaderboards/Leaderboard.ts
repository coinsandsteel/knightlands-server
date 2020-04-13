import { EventEmitter } from "events";
import { Db } from "mongodb";

export class Leaderboard extends EventEmitter {
    _db: Db;

    constructor(db: Db) {
        super();

        this._db = db;
    }

    async create(duration: number, ) {

    }

    async load(id: string|number) {

    }

    async save() {

    }
};