import _ from "lodash";
import { ABILITY_DASH, ABILITY_FLIGHT, ABILITY_RUSH, ABILITY_TELEPORTATION, ABILITY_TYPE_ATTACK, UNIT_CLASS_MAGE, UNIT_CLASS_MELEE, UNIT_CLASS_RANGE, UNIT_CLASS_SUPPORT, UNIT_CLASS_TANK } from "../../../knightlands-shared/battle";
import { BattleController } from "../BattleController";
import { SETTINGS } from "../meta";
import { Unit } from "../units/Unit";

export class BattleCombat {
  protected _ctrl: BattleController;

  constructor(ctrl: BattleController) {
    this._ctrl = ctrl;
  }

  public attack(fighter: Unit, index: number, abilityClass: string): void {
    const attackCells = this.getAttackCells(fighter, abilityClass);
    if (!attackCells.includes(index)) {
      return;
    }

    const enemy = this._ctrl.game.getFighterByIndex(index);
    if (!enemy) {
      console.log("No enemy at the cell", index);
      return;
    }

    const abilityData = fighter.getAbilityByClass(abilityClass);
    const dmgBase = abilityData.value;
    const defBase = enemy.defence;
    const percentBlocked = (100*(defBase*0.05))/(1+(defBase*0.05))/100;
    const damage = Math.round(dmgBase * (1 - percentBlocked));

    fighter.modifyHp(-damage);

    // TODO simple hit
    // TODO critical hit
    // TODO cooldown

    this._ctrl.events.effect({
      action: ABILITY_TYPE_ATTACK,
      source: {
        fighterId: fighter.fighterId,
        index: fighter.index
      },
      target: {
        fighterId: enemy.fighterId,
        index: enemy.index,
        newHp: enemy.hp
      },
      ability: {
        abilityClass,
        damage,
        criticalHit: false
      }
    });
  }

  public getRangeAndScheme(fighter: Unit, abilityClass: string): { range: number, scheme: string } {
    switch (fighter.class) {
      case UNIT_CLASS_SUPPORT: {
        return { range: 2, scheme: SETTINGS.attackScheme };
      }
      case UNIT_CLASS_MAGE: {
        return { range: 2, scheme: SETTINGS.attackScheme };
      }
      case UNIT_CLASS_MELEE: {
        if (abilityClass === ABILITY_FLIGHT) {
          return { range: 2, scheme: SETTINGS.jumpScheme };
        } else {
          return { range: 1, scheme: SETTINGS.attackScheme };
        }
      }
      case UNIT_CLASS_RANGE: {
        if (abilityClass === ABILITY_DASH) {
          return { range: fighter.speed + 2, scheme: SETTINGS.jumpScheme };
        } else {
          return { range: 1, scheme: SETTINGS.attackScheme };
        }
      }
      case UNIT_CLASS_TANK: {
        switch (abilityClass) {
          case ABILITY_RUSH: {
            return { range: fighter.speed + 2, scheme: SETTINGS.jumpScheme };
          }
          case ABILITY_TELEPORTATION:
          case ABILITY_FLIGHT: {
            return { range: 2, scheme: SETTINGS.jumpScheme };
          }
          default: {
            return { range: 1, scheme: SETTINGS.attackScheme };
          }
        }
      }
    }
  }

  public getAttackCells(fighter: Unit, abilityClass: string): number[] {
    const rangeData = this.getRangeAndScheme(fighter, abilityClass);
    const rangeCells = this._ctrl.game.movement.getRangeCells(fighter.index, rangeData.range, rangeData.scheme);
    return rangeCells;
    //const enemyCells = this._ctrl.game.relativeEnemySquad.map(unit => unit.index);
    //return _.intersection(rangeCells, enemyCells);
  }
}
