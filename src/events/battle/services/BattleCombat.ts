import _ from "lodash";
import { ABILITY_TYPE_ATTACK, ABILITY_TYPE_HEALING } from "../../../knightlands-shared/battle";
import { BattleController } from "../BattleController";
import { Unit } from "../units/Unit";

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
    const attackCells = this.getAttackCells(source, abilityClass, true, true);
    return attackCells.includes(target.index);
  }

  public getAttackCells(fighter: Unit, abilityClass: string, canMove: boolean, onlyTargets: boolean): number[] {
    const abilityStat = fighter.getAbilityStat(abilityClass);
    if (!abilityStat.attackRange) {
      return [];
    }

    const attackCells = this._ctrl.game.movement.getAttackCells(
      fighter.index, 
      canMove ? abilityStat.moveRange : 0,
      abilityStat.attackRange
    );

    if (onlyTargets) {
      const enemyCells = this._ctrl.game.relativeEnemySquad.map(unit => unit.index);
      console.log("[Combat] Relative enemy indexes", enemyCells);
      return _.intersection(attackCells, enemyCells);
    } else {
      return attackCells;
    }
  }

  public tryApproachEnemy(fighter: Unit, target: Unit, abilityClass: string) {
    const attackCellsNoMoving =  this.getAttackCells(fighter, abilityClass, false, true);
    // Need to approach
    if (!attackCellsNoMoving.includes(target.index)) {
      console.log("[Combat] Need to approach the enemy");
      const abilityStat = fighter.getAbilityStat(abilityClass);
      
      // Calc all the move cells
      const moveCells = this._ctrl.game.movement.getMoveCells(fighter.index, abilityStat.moveRange);
      
      // Iterate move cells to check if fighter can reach enemy from there
      let canAttackFrom = [];
      moveCells.forEach(moveCell => {
        const attackPath = this._ctrl.game.movement.getPath(fighter.index, moveCell, false);
        if (attackPath.length < abilityStat.attackRange) {
          canAttackFrom.push({ index: moveCell, range: attackPath.length });
        }
      });
      
      // Have spots to approach
      if (canAttackFrom.length) {
        // Move to a closest move cell
        const closestCell = _.head(_.sortBy(canAttackFrom, "range"));
        if (closestCell) {
          canAttackFrom = _.filter(canAttackFrom, { range: closestCell.range });
        }
        // Move to attack spot
        const targetIndex = _.sample(canAttackFrom).index;
        this._ctrl.game.movement.moveFighter(fighter, targetIndex);
        console.log(`[Combat] Approaching enemy onto index ${targetIndex}`);
      }
    }
  }
}
