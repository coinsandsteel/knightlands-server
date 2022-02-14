import { Unit } from "./other/UnitClass";
import * as march from "../../knightlands-shared/march";
import Random from "../../random";

export class MarchDamage {
    private _cards: Unit[];

    constructor(cards: Unit[]) {
        this._cards = cards;
    }

    public getVictims(attacker: Unit, direction: string): Unit[] {
      const victims: Unit[] = [];
      const unitStack = [...Array(9).keys()];
      unitStack.splice(attacker.index, 1);
      switch (direction) {
        case march.DIRECTION_RANDOM5: {
          var i = 0;
          do {
            const randomNumber = Random.pick(unitStack);
            const randomIndex = unitStack.indexOf(randomNumber);
            const victim = this._cards[randomNumber];
            if (victim.isEnemy) {
              victims.push(victim);
              i++;
            }
            unitStack.splice(randomIndex, 1);
          } while (unitStack.length > 0 && i < 5)
          break;
        }
        case march.DIRECTION_ALL: {
          for (var i = 0; i < 9; i++) {
            const victim = this._cards[i];
              if (!victim.isPet) {
                victims.push(victim);
              }
          }
          break;
        }
        case march.DIRECTION_CROSS: {
          for (const adjacentIndex in march.ADJACENT_CELLS[attacker.index]) {
            // TODO check this._cards[adjacentIndex] is working properly
            victims.push(this._cards[adjacentIndex]);
          }
          break;
        }
      }
      return victims;
    }
    
    public getHpModifier(attacker: Unit, victim: Unit): number {
      switch(attacker.unitClass) {
        case march.UNIT_CLASS_BALL_LIGHTNING: {
          switch(victim.unitClass) {
            case march.UNIT_CLASS_ENEMY: 
            case march.UNIT_CLASS_ENEMY_BOSS: 
            case march.UNIT_CLASS_TRAP: {
              return -attacker.hp;
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
              return -attacker.hp;
            }
            case march.UNIT_CLASS_BOW:{
              return attacker.hp;
            }
          }
          break;
        }
        case march.UNIT_CLASS_DRAGON_BREATH: {
          switch(victim.unitClass) {
            case march.UNIT_CLASS_ENEMY:
            case march.UNIT_CLASS_ENEMY_BOSS:
            case march.UNIT_CLASS_TRAP:
            case march.UNIT_CLASS_BARREL:
            case march.UNIT_CLASS_HP:
            case march.UNIT_CLASS_ARMOR:
            case march.UNIT_CLASS_BOW:
            case march.UNIT_CLASS_BALL_LIGHTNING:{ 
              return -10000;
            }
            default: { 
              return 0; 
            }
          }
          break;
        }
        case march.UNIT_CLASS_BOMB: {
          switch(victim.unitClass) {
            case march.UNIT_CLASS_ENEMY:
            case march.UNIT_CLASS_ENEMY_BOSS:
            case march.UNIT_CLASS_TRAP:
            case march.UNIT_CLASS_BARREL:
            case march.UNIT_CLASS_PET:
            case march.UNIT_CLASS_HP:
            case march.UNIT_CLASS_ARMOR:
            case march.UNIT_CLASS_BOW:
            case march.UNIT_CLASS_BALL_LIGHTNING:{ 
              return -attacker.hp;
            }
            default: { 
              return 0; 
            }
          }
          break;
        }
      }
      return 0;
    }
}