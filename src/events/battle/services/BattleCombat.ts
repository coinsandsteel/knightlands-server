import _ from "lodash";
import { ABILITY_ATTACK, ABILITY_DASH, ABILITY_FLIGHT, ABILITY_RUSH, ABILITY_TELEPORTATION, ABILITY_TYPES, ABILITY_TYPE_ATTACK, ABILITY_TYPE_BUFF, ABILITY_TYPE_HEALING, ABILITY_TYPE_JUMP, ABILITY_TYPE_SELF_BUFF, UNIT_CLASS_MAGE, UNIT_CLASS_MELEE, UNIT_CLASS_RANGE, UNIT_CLASS_SUPPORT, UNIT_CLASS_TANK } from "../../../knightlands-shared/battle";
import { BattleController } from "../BattleController";
import { ABILITIES, SETTINGS } from "../meta";
import { Unit } from "../units/Unit";

// TODO incrementing effects
// TODO conditions
//  - incoming_damage
//  - debuff
// TODO terrain
// - ice
// - swamp
// - hill
// - woods

export class BattleCombat {
  protected _ctrl: BattleController;

  constructor(ctrl: BattleController) {
    this._ctrl = ctrl;
  }

  public groupHeal(source: Unit, abilityClass: string): void {
    const squad = this._ctrl.game.getSquadByFighter(source);
    const targets = squad.units;
    targets.forEach(target => {
      if (this.canAffect(source, target, abilityClass)) {
        this.heal(source, target, abilityClass);
      }
    });
  }

  public heal(source: Unit, target: Unit, abilityClass: string): void {
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }

    const value = source.getAbilityValue(abilityClass);
    const oldHp = target.hp;
    target.modifyHp(+value);

    this._ctrl.events.effect({
      action: ABILITY_TYPE_HEALING,
      source: {
        fighterId: source.fighterId,
        index: source.index
      },
      target: {
        fighterId: target.fighterId,
        index: target.index,
        oldHp,
        newHp: target.hp
      },
      ability: {
        abilityClass,
        value,
        criticalHit: false
      }
    });
  }

  // TODO apply buff
  public buff(source: Unit, target: Unit, abilityClass: string): void {
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }
    
    const abilityStat = source.getAbilityStat(abilityClass);
    return;

    //const buff = BUFFS[abilityClass][abilityData.level];
    /*const buffState = target.buff({
      source: abilityData.abilityType, ...buff 
    });

    const abilityType = ABILITY_TYPES[abilityClass];
    this._ctrl.events.effect({
      action: abilityType,
      source: {
        fighterId: source.fighterId,
        index: source.index
      },
      target: {
        fighterId: target.fighterId,
        index: target.index
      },
      buff: buffState
    });*/
  }

  public attack(source: Unit, target: Unit, abilityClass: string): void {
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }

    const dmgBase = source.getAbilityValue(abilityClass);
    const defBase = target.defence;
    const percentBlocked = (100*(defBase*0.05))/(1+(defBase*0.05))/100;
    const damage = Math.round(dmgBase * (1 - percentBlocked));

    console.log("[Combat] Attack", {
      dmgBase,
      defBase,
      percentBlocked,
      damage
    });

    const oldHp = target.hp;
    target.modifyHp(-damage);
    if (target.hp > 0) {
      this.attackCallback()
    }

    this._ctrl.events.effect({
      action: ABILITY_TYPE_ATTACK,
      source: {
        fighterId: source.fighterId,
        index: source.index
      },
      target: {
        fighterId: target.fighterId,
        index: target.index,
        oldHp,
        newHp: target.hp
      },
      ability: {
        abilityClass,
        damage,
        criticalHit: false
      }
    });
  }

  protected attackCallback() {
    // TODO Stack
    // TODO Counter attack
  }

  public canAffect(source: Unit, target: Unit, abilityClass: string): boolean {
    const attackCells = this.getAttackCells(source, abilityClass, true);
    return attackCells.includes(target.index);
  }

  public getAttackCells(fighter: Unit, abilityClass: string, onlyTargets: boolean): number[] {
    const abilityStat = fighter.getAbilityStat(abilityClass);
    if (!abilityStat.attackRange || !abilityStat.damageScheme) {
      return [];
    }

    const range = abilityStat.canMove ?
      abilityStat.moveRange + abilityStat.attackRange
      :
      abilityStat.attackRange;

    const rangeCells = this._ctrl.game.movement.getRangeCells(fighter.index, range);

    if (onlyTargets) {
      const enemyCells = this._ctrl.game.relativeEnemySquad.map(unit => unit.index);
      console.log("[Combat] Relative enemy indexes", enemyCells);
      return _.intersection(rangeCells, enemyCells);
    } else {
      return rangeCells;
    }
  }
}
