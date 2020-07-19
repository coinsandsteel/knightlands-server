import { Db, Collection, ObjectId } from "mongodb";
import { Collections } from "../database";
import { ArmySummonMeta, ArmyUnit, UnitMeta, UnitAbilitiesMeta } from "./ArmyTypes";
import SummonType from "../knightlands-shared/army_summon_type";
const bounds = require("binary-search-bounds");
import Random from "../random";
import WeightedList from "../js-weighted-list";

let comparator = (x, roll) => {
    return x.weight - roll;
};

export class ArmySummoner {
    private _db: Db;
    private _meta: ArmySummonMeta;
    private _units: { [key: string]: UnitMeta };
    private _abilities: UnitAbilitiesMeta;

    constructor(db: Db) {
        this._db = db;
    }

    async init() {
        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "army_summon_meta" })
        this._abilities = await this._db.collection(Collections.Meta).findOne({ _id: "army_abilities" });
        this._units = (await this._db.collection(Collections.Meta).findOne({ _id: "army_units" })).units;
    }

    async summon(total: number, summonType: number) {
        let count = total;
        let units = [];
        while (count-- > 0) {
            units.push(await this._summon(summonType));
        }

        return units;
    }

    private async _summon(summonType: number) {
        let summonMeta = summonType == SummonType.Normal ? this._meta.normalSummon : this._meta.advancedSummon;

        let unit: ArmyUnit;

        let roll = Random.range(1, summonMeta.totalWeight, true);
        let rolledRecordIndex = bounds.gt(summonMeta.summonGroups, roll, comparator);
        if (rolledRecordIndex >= 0) {
            let group = summonMeta.summonGroups[rolledRecordIndex];
            let typeRoll = Random.range(1, group.generalsWeight + group.troopsWeight, true);
            let isTroop = typeRoll <= group.troopsWeight;
            let content = isTroop ? this._meta.troops[group.stars] : this._meta.generals[group.stars];

            // roll unit
            let unitIndex = bounds.gt(content.units, Random.range(1, content.totalWeight, true), comparator);
            if (unitIndex >= 0) {
                let unitTemplate = content.units[unitIndex].unit;
                // generate abilities
                let abilities = await this._generateAbilities(unitTemplate);
                unit = {
                    troop: isTroop,
                    template: unitTemplate,
                    promotions: 0,
                    id: 0,
                    level: 1,
                    abilities: abilities,
                    items: {},
                    gold: 0,
                    essence: 0,
                    souls: 0,
                    legion: -1
                };
            }
        }

        return unit;
    }

    private async _generateAbilities(unitTemplate: number, stars: number = 0) {
        let template = this._units[unitTemplate];
        const abilities = [...template.fixedAbilities];

        // generate random abilities based on stars
        if (stars == 0) {
            stars = template.stars;
        }

        let randomAbilitiesCount = 0;
        switch (stars) {
            case 1:
                randomAbilitiesCount = 0;
                break;
            case 2:
                randomAbilitiesCount = 1;
                break;
            case 3:
                randomAbilitiesCount = 2;
                break;
            default:
                randomAbilitiesCount = 3;
                break;
        }

        if (randomAbilitiesCount > 0) {
            const fillerPool = template.troop ? this._abilities.fillers.troops : this._abilities.fillers.generals;
            const perUnitList = new WeightedList(template.abilityPool.abilities);
            const fillerList = new WeightedList(fillerPool.abilities);

            while (randomAbilitiesCount-- > 0 ) {
                // first determine if filler passsive must be rolled
                if (Random.intRange(1, 100) <= fillerPool.weight) {
                    abilities.push(...fillerList.peek(1, false))
                } else {
                    console.log(
                        `roll unit random abilities for ${template.id}`
                    )
                    abilities.push(...perUnitList.peek(1, false))
                }
            }
        }

        return abilities;
    }
}
