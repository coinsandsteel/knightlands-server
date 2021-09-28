import { Collections } from "./database/database";
import Game from "./game";

export class QuestZones {
    private _zones: { [key: number]: any };
    public totalZones: number;

    async init() {
        this._zones = {};

        const zones = await Game.db.collection(Collections.Zones).find().toArray();

        for (const zone of zones) {
            this._zones[zone._id] = zone;
        }
        this.totalZones = zones.length;
    }

    getZone(zoneId: number) {
        return this._zones[zoneId];
    }
}