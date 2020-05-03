import Game from "../game";
import { Db, ObjectId } from "mongodb";
import { Collections } from "../database";
import { Lock } from "../utils/lock";
import { ArmyMeta, GeneralsMeta, TroopsMeta, UnitAbilitiesMeta } from "./ArmyTypes";

export class ArmyManager {
    private _db: Db;
    private _lock: Lock;
    private _meta: ArmyMeta;
    private _generals: GeneralsMeta;
    private _troops: TroopsMeta;
    private _abilities: UnitAbilitiesMeta;

    constructor(db: Db) {
        this._db = db;
        this._lock = new Lock();
    }

    async init() {
        console.log("Initializing army manager...");

        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "army" });
        this._generals = await this._db.collection(Collections.Meta).findOne({ _id: "troops" });
        this._troops = await this._db.collection(Collections.Meta).findOne({ _id: "generals" });
        this._abilities = await this._db.collection(Collections.Meta).findOne({ _id: "army_abilities" });
    }
}

