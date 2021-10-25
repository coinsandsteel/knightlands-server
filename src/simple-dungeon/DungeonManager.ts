import { Collections } from "../database/database";
import Game from "../game";
import { DungeonMeta } from "./types";

export class DungeonManager {
    private _meta: DungeonMeta;

    constructor() {

    }

    async init() {
        this._meta = await Game.db.collection(Collections.Meta).findOne({ _id: "simple_dungeon_meta" });

        // preprocess some data
        for (const enemyId in this._meta.enemies.enemiesById) {
            const enemy = this._meta.enemies.enemiesById[enemyId];

            let index = 0;
            for (const set of enemy.moves) {
                set.index = index;
                index++;
            }
        }
    }

    getMeta() {
        return this._meta;
    }

    getEnemyData(enemyId: number) {
        return this.getMeta().enemies.enemiesById[enemyId];
    }
}