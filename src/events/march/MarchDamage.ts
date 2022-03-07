import { Unit } from "./other/UnitClass";
import * as march from "../../knightlands-shared/march";
import Random from "../../random";
import { MarchMap } from "./MarchMap";

export class MarchDamage {
    private _cards: Unit[];
    private _map: MarchMap;

    constructor(cards: Unit[], map: MarchMap) {
      this._cards = cards;
      this._map = map;
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
            let damage = this.getHpModifier(attacker, victim);
            if (victim.isEnemy && damage !== 0) {
              victims.push(victim);
              i++;
            }
            unitStack.splice(randomIndex, 1);
          } while (unitStack.length > 0 && i < 5)
          break;
        }
        case march.DIRECTION_ALL: {
          this._cards.forEach(victim => {
            let damage = this.getHpModifier(attacker, victim);
            if (damage !== 0) {
              victims.push(victim);
            }
          });
          break;
        }
        case march.DIRECTION_CROSS: {
          march.ADJACENT_CELLS[attacker.index].forEach(adjacentIndex => {
            let victim = this._cards[adjacentIndex];
            let damage = this.getHpModifier(attacker, victim);
            if (damage !== 0) {
              victims.push(victim);
            }
          });
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
          let bonus = this._map.pet.checkClassAndLevel(2, 1) ? 1 : 0;
          switch(victim.unitClass) {
            case march.UNIT_CLASS_ENEMY:
            case march.UNIT_CLASS_ENEMY_BOSS:
            case march.UNIT_CLASS_TRAP:
            case march.UNIT_CLASS_HP:
            case march.UNIT_CLASS_ARMOR: {
              if (bonus) {
                //console.log('[Pet C2/L1] PASSED. Bow damage +1');
              } else {
                //console.log('[Pet C2/L1] FAILED. Bow damage +0');
              }
              return -(attacker.hp + bonus);
            }
            case march.UNIT_CLASS_BOW:{
              let stackBonus = this._map.pet.checkClassAndLevel(2, 2) ? 2 : 0;
              if (stackBonus) {
                //console.log('[Pet C2/L2] PASSED. Bow stack +2');
              } else {
                //console.log('[Pet C2/L2] FAILED. Bow stack +0');
              }
              return attacker.hp + stackBonus;
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
            case march.UNIT_CLASS_PET:{
              const bombProtected = this._map.pet.checkClassAndLevel(2, 3);
              if (bombProtected) {
                //console.log('[Pet C2/L3] PASSED. Bomb damage = 0.');
              } else {
                //console.log(`[Pet C2/L3] FAILED. Bomb damage = ${-attacker.hp}.`);
              }
              return bombProtected ? 0 : -attacker.hp;
            }
            case march.UNIT_CLASS_ENEMY:
            case march.UNIT_CLASS_ENEMY_BOSS:
            case march.UNIT_CLASS_TRAP:
            case march.UNIT_CLASS_BARREL:
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