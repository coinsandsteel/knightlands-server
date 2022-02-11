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

    private ENEMY_HP_MIN = 5;
    private ENEMY_HP_MAX = 10;
    private BOOSTER_HP_MIN = 1;
    private BOOSTER_HP_MAX = 4;
    private BOOSTER_AMOR_MIN = 1;
    private BOOSTER_AMOR_MAX = 4;
    private CONTAINER_BARREL_MIN = 1;
    private CONTAINER_BARREL_MAX = 4;
    private GOLD_AMOUNT_MIN = 1;
    private GOLD_AMOUNT_MAX = 4;
    private BOW_MIN = 1;
    private BOW_MAX = 4;
    private BALL_LIGHTNING_MIN = 1;
    private BALL_LIGHTNING_MAX = 5;
    private BOMB_MIN = 1;
    private BOMB_MAX = 5;

    private _pool: Unit[];
    private _map: MarchMap;

    private cardDrawnCount: number;
    private bossAppearStep: number;
    private bossAppearStepCount: number;

    constructor(map: MarchMap) {
        this._map = map;
        this.cardDrawnCount = 0;
        this.bossAppearStep = this.FIRST_BOSS_APPEAR_STEPS;
        this.bossAppearStepCount = 0;
        this.pushCardsToPool();
    }

    private pushCardsToPool() {
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
                  unit = { _id: null, unitClass: march.UNIT_CLASS_ENEMY, hp: Random.intRange(this.ENEMY_HP_MIN, this.ENEMY_HP_MAX) }
                  break;
              case (random < TRAP_SUM):
                  unit = { _id: null, unitClass: march.UNIT_CLASS_TRAP, hp: 1, opened: true };
                  break;
              case (random < BOOSTER_SUM):
                  const randomBooster = Random.intRange(0, 2);
                  switch (randomBooster) {
                      case 0:
                          unit = { _id: null, unitClass: march.UNIT_CLASS_ARMOR, hp: Random.intRange(this.BOOSTER_AMOR_MIN, this.BOOSTER_AMOR_MAX)};
                          break;
                      case 1:
                          unit = { _id: null, unitClass: march.UNIT_CLASS_HP, hp: Random.intRange(this.BOOSTER_HP_MIN, this.BOOSTER_HP_MAX)};
                          break;
                      case 2:
                          unit = { _id: null, unitClass: march.UNIT_CLASS_EXTRA_HP, hp: 1};
                          break;
                  }
                  break;
              case (random < BARREL_SUM):
                  unit = { _id: null, unitClass: march.UNIT_CLASS_BARREL, hp: Random.intRange(this.CONTAINER_BARREL_MIN, this.CONTAINER_BARREL_MAX)};
                  break;
              case (random < GOLD_SUM):
                  unit = { _id: null, unitClass: march.UNIT_CLASS_GOLD, hp: Random.intRange(this.GOLD_AMOUNT_MIN, this.GOLD_AMOUNT_MAX)};
                  break;
              default:
                  alert("none");
                  break;
            }
            const newUnit = this._map.makeUnit(unit);
            this._pool.push(newUnit);
        }
    }

    public getCardFromPool(): Unit {
        const cardDrawn = this._pool[this.cardDrawnCount];
        this.cardDrawnCount++;
        this.bossAppearStepCount++;
        if (this.bossAppearStepCount % this.bossAppearStep === 0) {
            this.pushCardsToPool();
            this.bossAppearStep++;
            this.bossAppearStepCount = 0;
        }
        return cardDrawn;
    }

    public getCardForBarrel(barrelHp: number): Unit {
        const random = Random.intRange(0, 3);
        var unit: MarchCard;
        switch (random) {
            case 0:
                unit = { _id: null, unitClass: march.UNIT_CLASS_ARMOR, hp: Random.intRange(this.BOOSTER_AMOR_MIN, this.BOOSTER_AMOR_MAX)};
                break;
            case 1:
                unit = { _id: null, unitClass: march.UNIT_CLASS_HP, hp: barrelHp};
                break;
            case 2:
                unit = { _id: null, unitClass: march.UNIT_CLASS_BOW, hp: Random.intRange(this.BOW_MIN, this.BOW_MAX)};
                break;
            case 3:
                unit = { _id: null, unitClass: march.UNIT_CLASS_ENEMY, hp: Random.intRange(this.ENEMY_HP_MIN, this.ENEMY_HP_MAX)};
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
                unit = { _id: null, unitClass: march.UNIT_CLASS_BALL_LIGHTNING, hp: Random.intRange(this.BALL_LIGHTNING_MIN, this.BALL_LIGHTNING_MAX)};
                break;
            case 2:
                unit = { _id: null, unitClass: march.UNIT_CLASS_DRAGON_BREATH, hp: 10000};
                break;
            case 3:
                unit = { _id: null, unitClass: march.UNIT_CLASS_BOMB, hp: Random.intRange(this.BOMB_MIN, this.BOMB_MAX)};
                break;
        }
        return this._map.makeUnit(unit);
    }

    public getCardForDestructedChest(): Unit {
        const random = Random.intRange(0, 4);
        var unit: MarchCard;
        switch (random) {
            case 0:
                unit = { _id: null, unitClass: march.UNIT_CLASS_ENEMY, hp: Random.intRange(this.ENEMY_HP_MIN, this.ENEMY_HP_MAX)};  
                break;
            case 1:
                unit = { _id: null, unitClass: march.UNIT_CLASS_ARMOR, hp: Random.intRange(this.BOOSTER_AMOR_MIN, this.BOOSTER_AMOR_MAX)};
                break;
            case 2:
                unit = { _id: null, unitClass: march.UNIT_CLASS_HP, hp: Random.intRange(this.BOOSTER_HP_MIN, this.BOOSTER_HP_MAX)};
                break;
            case 3:
                unit = { _id: null, unitClass: march.UNIT_CLASS_BOW, hp: Random.intRange(this.BOW_MIN, this.BOW_MAX)};
                break;
            case 4:
                unit = { _id: null, unitClass: march.UNIT_CLASS_TRAP, hp: 1, opened: true };
                break;
        }
        return this._map.makeUnit(unit);
    }
}