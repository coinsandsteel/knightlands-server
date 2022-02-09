import { ObjectId } from "mongodb";
import game from "../../game";
import events from "../../knightlands-shared/events";
import { Unit } from "./other/UnitClass";
import * as march from "../../knightlands-shared/march";
import Random from "../../random";
import { Enemy } from "./units/Enemy";

export class MarchDamage {
    private _cards: Unit[];

    constructor(cards: Unit[]) {
        this._cards = cards;
    }

    handleScriptDamage(attacker, attackerIndex, amount, direction) {
        const array = [...Array(9).keys()];
        array.splice(attackerIndex, 1);
        switch (direction) {
            case march.DIRECTION_RANDOM5: {
                var i = 0;
                do {
                    const random = Random.pick(array);
                    const randomIndex = array.indexOf(random);
                    array.splice(randomIndex, 1);
                    if (this._cards[random].isEnemy) {
                        const hpAmount = this.handleDamage(attacker, this._cards[random], amount);
                        this._cards[random].modifyHp(hpAmount, attacker);
                        i++;
                    }
                } while (array.length === 0 || i === 5)
                break;
            }
            case march.DIRECTION_ALL: {
                for (var i = 0; i < 9; i++) {
                    if (!this._cards[i].isPet) {
                        const hpAmount = this.handleDamage(attacker, this._cards[i], amount)
                        this._cards[i].modifyHp(hpAmount, attacker);
                    }
                }
                break;
            }
            case march.DIRECTION_CROSS: {
                for (const adjacentIndex in march.ADJACENT_CELLS[attackerIndex]) {
                    const hpAmount = this.handleDamage(attacker, this._cards[adjacentIndex], amount)
                    this._cards[adjacentIndex].modifyHp(hpAmount, attacker);
                }
                break;
            }
        }
    }
    
    handleDamage(attacker: Unit, victim: Unit, amount: number): number {
        let damage: number = 0;
        switch(attacker.getUnitClass) {
            case march.UNIT_CLASS_BALL_LIGHTNING: {
                switch(victim.getUnitClass) {
                    case march.UNIT_CLASS_ENEMY: 
                    case march.UNIT_CLASS_ENEMY_BOSS: 
                    case march.UNIT_CLASS_TRAP: {
                        return amount;
                    }
                }
                break;
            }
            case march.UNIT_CLASS_BOW: {
                switch(victim.getUnitClass) {
                    case march.UNIT_CLASS_ENEMY:
                    case march.UNIT_CLASS_ENEMY_BOSS:
                    case march.UNIT_CLASS_TRAP:
                    case march.UNIT_CLASS_HP:
                    case march.UNIT_CLASS_ARMOR: {
                        return amount;
                    }
                    case march.UNIT_CLASS_BOW:{
                        return -amount;
                    }
                }
                break;
            }
            case march.UNIT_CLASS_DRAGON_BREATH: {
                switch(victim.getUnitClass) {
                    case march.UNIT_CLASS_PET:
                    case march.UNIT_CLASS_CHEST:
                    case march.UNIT_CLASS_EXTRA_HP:
                    case march.UNIT_CLASS_DRAGON_BREATH:
                    case march.UNIT_CLASS_BOMB:
                    case march.UNIT_CLASS_GOLD: { 
                        return 0;
                    }
                    default: { 
                        return amount; 
                    }
                }
                break;
            }
            case march.UNIT_CLASS_BOMB: {
                switch(victim.getUnitClass) {
                    case march.UNIT_CLASS_CHEST:
                    case march.UNIT_CLASS_EXTRA_HP:
                    case march.UNIT_CLASS_DRAGON_BREATH:
                    case march.UNIT_CLASS_BOMB:
                    case march.UNIT_CLASS_GOLD: { 
                        return 0;
                    }
                    default: { 
                        return amount; 
                    }
                }
                break;
            }
            
        }
        
        return 0;
    }
}