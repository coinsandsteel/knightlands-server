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

    handleScriptDamage(attacker: Unit, attackerIndex: number, hpModifier: number, direction: string): void {
        const unitStack = [...Array(9).keys()];
        unitStack.splice(attackerIndex, 1);
        switch (direction) {
            case march.DIRECTION_RANDOM5: {
                var i = 0;
                do {
                    const randomNumber = Random.pick(unitStack);
                    const randomIndex = unitStack.indexOf(randomNumber);
                    unitStack.splice(randomIndex, 1);
                    if (this._cards[randomNumber].isEnemy) {
                        const currentHpModifier = this.handleDamage(attacker, this._cards[randomNumber], hpModifier);
                        this._cards[randomNumber].modifyHp(currentHpModifier, attacker);
                        i++;
                    }
                } while (unitStack.length === 0 || i === 5)
                break;
            }
            case march.DIRECTION_ALL: {
                for (var i = 0; i < 9; i++) {
                    if (!this._cards[i].isPet) {
                        const currentHpModifier = this.handleDamage(attacker, this._cards[i], hpModifier)
                        this._cards[i].modifyHp(currentHpModifier, attacker);
                    }
                }
                break;
            }
            case march.DIRECTION_CROSS: {
                for (const adjacentIndex in march.ADJACENT_CELLS[attackerIndex]) {
                    const currentHpModifier = this.handleDamage(attacker, this._cards[adjacentIndex], hpModifier)
                    this._cards[adjacentIndex].modifyHp(currentHpModifier, attacker);
                }
                break;
            }
        }
    }
    
    handleDamage(attacker: Unit, victim: Unit, hpModifier: number): number {
        switch(attacker.unitClass) {
            case march.UNIT_CLASS_BALL_LIGHTNING: {
                switch(victim.unitClass) {
                    case march.UNIT_CLASS_ENEMY: 
                    case march.UNIT_CLASS_ENEMY_BOSS: 
                    case march.UNIT_CLASS_TRAP: {
                        return hpModifier;
                    }
                }
                break;
            }
            case march.UNIT_CLASS_BOW: {
                switch(victim.unitClass) {
                    case march.UNIT_CLASS_ENEMY:
                    case march.UNIT_CLASS_ENEMY_BOSS:
                    case march.UNIT_CLASS_TRAP:
                    case march.UNIT_CLASS_HP:
                    case march.UNIT_CLASS_ARMOR: {
                        return hpModifier;
                    }
                    case march.UNIT_CLASS_BOW:{
                        return -hpModifier;
                    }
                }
                break;
            }
            case march.UNIT_CLASS_DRAGON_BREATH: {
                switch(victim.unitClass) {
                    case march.UNIT_CLASS_HP:
                    case march.UNIT_CLASS_ARMOR:
                    case march.UNIT_CLASS_BOW:
                    case march.UNIT_CLASS_EXTRA_HP:
                    case march.UNIT_CLASS_DRAGON_BREATH:
                    case march.UNIT_CLASS_BOMB:
                    case march.UNIT_CLASS_GOLD: { 
                        return 0;
                    }
                    default: { 
                        return hpModifier; 
                    }
                }
                break;
            }
            case march.UNIT_CLASS_BOMB: {
                switch(victim.unitClass) {
                    case march.UNIT_CLASS_HP:
                    case march.UNIT_CLASS_ARMOR:
                    case march.UNIT_CLASS_BOW:
                    case march.UNIT_CLASS_EXTRA_HP:
                    case march.UNIT_CLASS_DRAGON_BREATH:
                    case march.UNIT_CLASS_BOMB:
                    case march.UNIT_CLASS_GOLD: { 
                        return 0;
                    }
                    default: { 
                        return hpModifier; 
                    }
                }
                break;
            }
            
        }
        return 0;
    }
}