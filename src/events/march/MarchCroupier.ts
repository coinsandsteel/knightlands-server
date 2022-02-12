import Random from "../../random";
import { MarchMap } from "./MarchMap";
import { Unit } from "./other/UnitClass";
import * as march from "../../knightlands-shared/march";
import { MarchCard } from "./types";

export class MarchCroupier {
    private ENEMY_PROBABILITY = 0.37;
    private TRAP_PROBABILITY = 0.074;
    private BOOSTER_PROBABILITY = 0.37;
    private BARREL_PROBABILITY = 0.111;
    private GOLD_PROBABILITY = 0.074;
    private FIRST_BOSS_APPEAR_STEPS = 10;

    private ENEMY_HP_MIN = 1;
    private ENEMY_HP_MAX_ARRAY = [4, 5, 6, 7, 8, 9, 10]; // for 7 pools
    private BOOSTER_HP_MIN = 1;
    private BOOSTER_HP_MAX_ARRAY = [3, 4, 4, 5, 5, 6, 6];
    private BOOSTER_AMOR_MIN = 1;
    private BOOSTER_AMOR_MAX_ARRAY = [6, 6, 6, 6, 6, 6, 6];
    private CONTAINER_BARREL_MIN = 2;
    private CONTAINER_BARREL_MAX_ARRAY = [2, 2, 3, 3, 3, 4, 4];
    private GOLD_AMOUNT_MIN = 1;
    private GOLD_AMOUNT_MAX_ARRAY = [3, 4, 5, 6, 7, 8, 9];
    private BOW_MIN = 1;
    private BOW_MAX_ARRAY = [3, 4, 4, 5, 5, 6, 6];
    private BALL_LIGHTNING_MIN = 1;
    private BALL_LIGHTNING_MAX_ARRAY = [5, 5, 5, 5, 5, 5, 5];
    private BOMB_MIN = 1;
    private BOMB_MAX_ARRAY = [5, 5, 5, 5, 5, 5, 5];
    private BOSS_HP_MIN = 10;
    private BOSS_HP_MAX_ARRAY = [10, 12, 14, 18, 22, 26, 30];

    private _map: MarchMap;

    private bossAppearStep: number;
    private bossAppearStepCount: number;
    private poolLevel: number;

    private enemyHpMax: number;
    private boosterHpMax: number;
    private boosterAmorMax: number;
    private containerBarrelMax: number;
    private goldAmountMax: number;
    private bowMax: number;
    private ballLightningMax: number;
    private bombMax: number;
    private bossHpMax: number;

    constructor(map: MarchMap) {
        this._map = map;
        this.bossAppearStepCount = 0;
        this.poolLevel = 0;
        this.bossAppearStep = this.FIRST_BOSS_APPEAR_STEPS;
        this.enemyHpMax = this.ENEMY_HP_MAX_ARRAY[0];
        this.boosterHpMax = this.BOOSTER_HP_MAX_ARRAY[0];
        this.boosterAmorMax = this.BOOSTER_AMOR_MAX_ARRAY[0];
        this.containerBarrelMax = this.CONTAINER_BARREL_MAX_ARRAY[0];
        this.goldAmountMax = this.GOLD_AMOUNT_MAX_ARRAY[0];
        this.bowMax = this.BOW_MAX_ARRAY[0];
        this.ballLightningMax = this.BALL_LIGHTNING_MAX_ARRAY[0];
        this.bombMax = this.BOMB_MAX_ARRAY[0];
        this.bossHpMax = this.BOSS_HP_MAX_ARRAY[0];
    }

    private pickCardFromPool(): Unit {
        const ENEMY_SUM = this.ENEMY_PROBABILITY;
        const TRAP_SUM = ENEMY_SUM + this.TRAP_PROBABILITY;
        const BOOSTER_SUM = TRAP_SUM + this.BOOSTER_PROBABILITY;
        const BARREL_SUM = BOOSTER_SUM + this.BARREL_PROBABILITY;
        const GOLD_SUM = BARREL_SUM + this.GOLD_PROBABILITY;
        for(var i = 0; i < this.bossAppearStep; i++) {
            const random = Random.range(0, 1);
            var unit: MarchCard;
            switch (true) {
                case (random < ENEMY_SUM):
                    unit = { _id: null, unitClass: march.UNIT_CLASS_ENEMY, hp: Random.intRange(this.ENEMY_HP_MIN, this.enemyHpMax) }
                    break;
                case (random < TRAP_SUM):
                    unit = { _id: null, unitClass: march.UNIT_CLASS_TRAP, hp: 1, opened: true };
                    break;
                case (random < BOOSTER_SUM):
                    const randomBooster = Random.intRange(0, 2);
                    switch (randomBooster) {
                        case 0:
                            unit = { _id: null, unitClass: march.UNIT_CLASS_ARMOR, hp: Random.intRange(this.BOOSTER_AMOR_MIN, this.boosterAmorMax)};
                            break;
                        case 1:
                            unit = { _id: null, unitClass: march.UNIT_CLASS_HP, hp: Random.intRange(this.BOOSTER_HP_MIN, this.boosterHpMax)};
                            break;
                        case 2:
                            unit = { _id: null, unitClass: march.UNIT_CLASS_EXTRA_HP, hp: 1};
                            break;
                    }
                    break;
                case (random < BARREL_SUM):
                    unit = { _id: null, unitClass: march.UNIT_CLASS_BARREL, hp: Random.intRange(this.CONTAINER_BARREL_MIN, this.containerBarrelMax)};
                    break;
                case (random < GOLD_SUM):
                    unit = { _id: null, unitClass: march.UNIT_CLASS_GOLD, hp: Random.intRange(this.GOLD_AMOUNT_MIN, this.goldAmountMax)};
                    break;
                default:
                    alert("none");
                    break;
            }
        }
        return this._map.makeUnit(unit);
    }

    private incrementPool(): void {
        this.enemyHpMax = this.ENEMY_HP_MAX_ARRAY[this.poolLevel];
        this.boosterHpMax = this.BOOSTER_HP_MAX_ARRAY[this.poolLevel];
        this.boosterAmorMax = this.BOOSTER_AMOR_MAX_ARRAY[this.poolLevel];
        this.containerBarrelMax = this.CONTAINER_BARREL_MAX_ARRAY[this.poolLevel];
        this.goldAmountMax = this.GOLD_AMOUNT_MAX_ARRAY[this.poolLevel];
        this.bowMax = this.BOW_MAX_ARRAY[this.poolLevel];
        this.ballLightningMax = this.BALL_LIGHTNING_MAX_ARRAY[this.poolLevel];
        this.bombMax = this.BOMB_MAX_ARRAY[this.poolLevel];
        this.bossHpMax = this.BOSS_HP_MAX_ARRAY[this.poolLevel];
    }

    public getCardFromPool(): Unit {
        this.bossAppearStepCount++;
        if (this.bossAppearStepCount % this.bossAppearStep === 0) {
            const unit = { _id: null, unitClass: march.UNIT_CLASS_ENEMY_BOSS, hp: Random.intRange(this.BOSS_HP_MIN, this.bossHpMax)};
            this.bossAppearStep++;
            this.bossAppearStepCount = 0;
            this.poolLevel++;
            this.incrementPool();

            return this._map.makeUnit(unit);
        } else {
            return this.pickCardFromPool();
        }
    }

    public getCardForBarrel(barrelHp: number): Unit {
        const random = Random.intRange(0, 3);
        var unit: MarchCard;
        switch (random) {
            case 0:
                unit = { _id: null, unitClass: march.UNIT_CLASS_ARMOR, hp: Random.intRange(this.BOOSTER_AMOR_MIN, this.BOOSTER_AMOR_MAX_ARRAY)};
                break;
            case 1:
                unit = { _id: null, unitClass: march.UNIT_CLASS_HP, hp: barrelHp};
                break;
            case 2:
                unit = { _id: null, unitClass: march.UNIT_CLASS_BOW, hp: Random.intRange(this.BOW_MIN, this.bowMax)};
                break;
            case 3:
                unit = { _id: null, unitClass: march.UNIT_CLASS_ENEMY, hp: Random.intRange(this.ENEMY_HP_MIN, this.enemyHpMax)};
                break;
        }
        return this._map.makeUnit(unit);
    }

    public getCardForOpenedChest(): Unit {
        const random = Random.intRange(0, 3);
        var unit: MarchCard;
        switch (random) {
            case 0:
                unit = { _id: null, unitClass: march.UNIT_CLASS_EXTRA_HP, hp: 1};
                break;
            case 1:
                unit = { _id: null, unitClass: march.UNIT_CLASS_BALL_LIGHTNING, hp: Random.intRange(this.BALL_LIGHTNING_MIN, this.ballLightningMax)};
                break;
            case 2:
                unit = { _id: null, unitClass: march.UNIT_CLASS_DRAGON_BREATH, hp: 10000};
                break;
            case 3:
                unit = { _id: null, unitClass: march.UNIT_CLASS_BOMB, hp: Random.intRange(this.BOMB_MIN, this.bombMax)};
                break;
        }
        return this._map.makeUnit(unit);
    }

    public getCardForDestructedChest(): Unit {
        const random = Random.intRange(0, 4);
        var unit: MarchCard;
        switch (random) {
            case 0:
                unit = { _id: null, unitClass: march.UNIT_CLASS_ENEMY, hp: Random.intRange(this.ENEMY_HP_MIN, this.enemyHpMax)};  
                break;
            case 1:
                unit = { _id: null, unitClass: march.UNIT_CLASS_ARMOR, hp: Random.intRange(this.BOOSTER_AMOR_MIN, this.boosterAmorMax)};
                break;
            case 2:
                unit = { _id: null, unitClass: march.UNIT_CLASS_HP, hp: Random.intRange(this.BOOSTER_HP_MIN, this.boosterHpMax)};
                break;
            case 3:
                unit = { _id: null, unitClass: march.UNIT_CLASS_BOW, hp: Random.intRange(this.BOW_MIN, this.bowMax)};
                break;
            case 4:
                unit = { _id: null, unitClass: march.UNIT_CLASS_TRAP, hp: 1, opened: true };
                break;
        }
        return this._map.makeUnit(unit);
    }
}