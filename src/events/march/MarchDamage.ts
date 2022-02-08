import { ObjectId } from "mongodb";
import game from "../../game";
import events from "../../knightlands-shared/events";
import { Unit } from "./other/UnitClass";
import * as march from "../../knightlands-shared/march";

export class MarchDamage {
    
    constructor() {
    }
    
    handleDamage(attacker: Unit, victim: Unit): number {
        let damage: number = 0;
        switch(attacker.getUnitClass()) {
            case march.UNIT_CLASS_BALL_LIGHTNING: {
                switch(victim.getUnitClass()) {
                    case march.UNIT_CLASS_ENEMY: 
                    case march.UNIT_CLASS_ENEMY_BOSS: 
                    case march.UNIT_CLASS_TRAP: {
                        return attacker.getHP();
                        break;
                    }
                }
                break;
            }
            case march.UNIT_CLASS_BOW: {
                switch(victim.getUnitClass()) {
                    case march.UNIT_CLASS_ENEMY:
                    case march.UNIT_CLASS_ENEMY_BOSS:
                    case march.UNIT_CLASS_TRAP:
                    case march.UNIT_CLASS_HP:
                    case march.UNIT_CLASS_ARMOR: {
                        return attacker.getHP();
                    }
                    case march.UNIT_CLASS_BOW:{
                        return -attacker.getHP();
                    }
                }
                break;
            }
            case march.UNIT_CLASS_DRAGON_BREATH: {
                switch(victim.getUnitClass()) {
                    case march.UNIT_CLASS_HP:
                    case march.UNIT_CLASS_ARMOR:
                    case march.UNIT_CLASS_BOW:
                    case march.UNIT_CLASS_EXTRA_HP:
                    case march.UNIT_CLASS_BALL_LIGHTNING:
                    case march.UNIT_CLASS_DRAGON_BREATH:
                    case march.UNIT_CLASS_BOMB:
                    case march.UNIT_CLASS_ENEMY: 
                    case march.UNIT_CLASS_ENEMY_BOSS: 
                    case march.UNIT_CLASS_BARRELL: 
                    case march.UNIT_CLASS_TRAP: {
                        return 1000;
                    }
                }
                break;
            }
            case march.UNIT_CLASS_BOMB: {
                switch(victim.getUnitClass()) {
                    case march.UNIT_CLASS_HP:
                    case march.UNIT_CLASS_ARMOR:
                    case march.UNIT_CLASS_BOW:
                    case march.UNIT_CLASS_EXTRA_HP:
                    case march.UNIT_CLASS_BALL_LIGHTNING:
                    case march.UNIT_CLASS_DRAGON_BREATH:
                    case march.UNIT_CLASS_BOMB:
                    case march.UNIT_CLASS_ENEMY: 
                    case march.UNIT_CLASS_ENEMY_BOSS: 
                    case march.UNIT_CLASS_BARRELL: 
                    case march.UNIT_CLASS_TRAP: {
                        return 1000;
                    }
                }
                break;
            }
            
        }
        
        return 0;
    }
}