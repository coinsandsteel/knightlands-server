import { Db } from "mongodb";
import { Collections } from "../database/database";
import { ArmySummonMeta, ArmyUnit, UnitMeta, UnitAbilitiesMeta } from "./ArmyTypes";
import SummonType from "../knightlands-shared/army_summon_type";
const bounds = require("binary-search-bounds");
import Random from "../random";
import WeightedList from "../js-weighted-list";
import random from "../random";

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
        this._meta = await this._db.collection(Collections.Meta).findOne({ _id: "army_summon_meta" }) as ArmySummonMeta
        this._abilities = await this._db.collection(Collections.Meta).findOne({ _id: "army_abilities" }) as UnitAbilitiesMeta;
        this._units = (await this._db.collection(Collections.Meta).findOne({ _id: "army_units" })).units;
    }

    async summon(total: number, summonType: number, firstTime: boolean = false) {
        let count = total;
        let units: ArmyUnit[] = [];
        while (count-- > 0) {
            units.push(this._summon(summonType, firstTime));
        }

        return units;
    }

    async summonWithStars(total: number, targetStars: number, summonType: number) {
        let count = total;
        let units: ArmyUnit[] = [];

        let totalTroopsWeight = 0;
        for (const stars in this._meta.troops) {
            totalTroopsWeight += this._meta.troops[stars].totalWeight;
        }

        let totalGeneralsWeight = 0;
        for (const stars in this._meta.generals) {
            totalGeneralsWeight += this._meta.generals[stars].totalWeight;
        }

        // if unit requests is beyond max stars, set min stars that can reach target stars
        let minStars = targetStars > 5 ? 4 : targetStars;

        while (count-- > 0) {
            let isTroop = random.intRange(1, totalTroopsWeight + totalGeneralsWeight) <= totalTroopsWeight;

            if (summonType == 1) {
                isTroop = true;
            } else if (summonType == 2) {
                isTroop = false;
            }

            const stars = random.intRange(minStars, targetStars);
            const unit = this._generateUnit(stars, isTroop);
            // if extra stars, promote unit
            unit.promotions = targetStars - stars;
            units.push(unit);
        }

        return units;
    }

    private _generateUnit(stars: number, isTroop: boolean) {
        let content = isTroop ? this._meta.troops[stars] : this._meta.generals[stars];

        // roll unit
        let unitIndex = bounds.gt(content.units, Random.range(1, content.totalWeight, true), comparator);
        if (unitIndex >= 0) {
            let unitTemplate = content.units[unitIndex].unit;
            // generate abilities
            let abilities = this._generateAbilities(unitTemplate);
            return {
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

        return null;
    }

    private _summon(summonType: number, firstTime: boolean = false) {
        let summonMeta = summonType == SummonType.Normal ? this._meta.normalSummon : this._meta.advancedSummon;

        let unit: ArmyUnit;

        let roll = Random.range(1, summonMeta.totalWeight, true);
        let rolledRecordIndex = bounds.gt(summonMeta.summonGroups, roll, comparator);
        if (rolledRecordIndex >= 0) {
            let group = summonMeta.summonGroups[rolledRecordIndex];
            let typeRoll = Random.range(1, group.generalsWeight + group.troopsWeight, true);

            // first time roll force troop for tutorial to progress
            let isTroop = firstTime || typeRoll <= group.troopsWeight;

            unit = this._generateUnit(group.stars, isTroop);
        }

        return unit;
    }

    private _generateAbilities(unitTemplate: number, stars: number = 0) {
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

            while (randomAbilitiesCount-- > 0) {
                // first determine if filler passive must be rolled
                if (Random.intRange(1, 100) <= fillerPool.weight || perUnitList.length == 0) {
                    abilities.push(...fillerList.peek(1, true))
                } else {
                    abilities.push(...perUnitList.peek(1, true))
                }
            }
        }

        return abilities;
    }
}
