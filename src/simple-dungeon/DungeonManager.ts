import { Collections } from "../database/database";
import Game from "../game";
import { DungeonMeta } from "./types";
import meta from "./meta";

export class DungeonManager {
    private _meta: DungeonMeta;

    constructor() {

    }

    async init() {
        this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "simple_dungeon_meta" });
    }

    getMeta() {
        return this._meta;
    }
}