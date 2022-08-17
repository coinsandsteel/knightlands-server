import _ from "lodash";
import { ABILITY_ATTACK, ABILITY_MOVE, ABILITY_TYPE_ATTACK, ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF, ABILITY_TYPE_HEALING, ABILITY_TYPE_JUMP, ABILITY_TYPE_SELF_BUFF } from "../../../knightlands-shared/battle";
import { BattleController } from "../BattleController";
import { ABILITIES } from "../meta";
import { Unit } from "../units/Unit";
import { BattleService } from "./BattleService";

export class BattleCombat extends BattleService {
  protected _ctrl: BattleController;

  constructor(ctrl: BattleController) {
    super();
    this._ctrl = ctrl;
  }

  public groupHeal(source: Unit, abilityClass: string): void {
    const attackCells = this.getMoveAttackCells(source, abilityClass, false, true);
    const targets = this._ctrl.game.getSquadByFighter(source);
    targets.forEach(target => {
      if (attackCells.includes(target.index)) {
        this.heal(source, target, abilityClass);
      }
    });

    this.enableCooldown(source, abilityClass);
  }

  public heal(source: Unit, target: Unit, abilityClass: string): void {
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }

    const abilityData = source.getAbilityByClass(abilityClass);
    const oldHp = target.hp;
    target.modifyHp(+abilityData.value);

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
        value: abilityData.value,
        criticalHit: false
      }
    });

    this.enableCooldown(source, abilityClass);
  }

  public buff(source: Unit, target: Unit, abilityClass: string): void {
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }
    
    const abilityStat = source.getAbilityStat(abilityClass);
    const effects = abilityStat.effects;
    if (!effects) {
      throw Error(`Buff ${abilityClass} has no effects`);
    }

    const abilityData = source.getAbilityByClass(abilityClass);
    effects.forEach(effect => {
      const buff = {
        source: abilityData.abilityType,
        ...effect
      };
      if (effect.type === "agro") {
        buff.targetFighterId = source.fighterId;
      }
      target.buff(buff);
    });

    this._ctrl.events.effect({
      action: abilityData.abilityType,
      source: {
        fighterId: source.fighterId,
        index: source.index
      },
      target: {
        fighterId: target.fighterId,
        index: target.index
      },
      ability: {
        abilityClass
      }
    });

    this.enableCooldown(source, abilityClass);
  }

  public attack(source: Unit, target: Unit, abilityClass: string): void {
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }

    const abilityData = source.getAbilityByClass(abilityClass);
    const dmgBase = abilityData.value;
    if (!_.isNumber(dmgBase)) {
      this.log("[Error data]", { abilityData });
      throw Error("");
    }
    const defBase = target.defence;
    const percentBlocked = (100*(defBase*0.05))/(1+(defBase*0.05))/100;
    const damage = Math.round(dmgBase * (1 - percentBlocked));

    this.log("Attack details", {
      source: source.fighterId,
      target: target.fighterId,
      abilityClass,
      dmgBase,
      defBase,
      percentBlocked,
      damage
    });

    const oldHp = target.hp;
    target.modifyHp(-damage);
    if (!target.isDead) {
      this.attackCallback(target);
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

    this.enableCooldown(source, abilityClass);
  }

  protected attackCallback(target: Unit) {
    target.attackCallback();
  }

  public canAffect(source: Unit, target: Unit, abilityClass: string): boolean {
    const abilityMeta = ABILITIES[source.class][abilityClass];
    const attackCells = this.getMoveAttackCells(source, abilityClass, abilityMeta.canMove, true);
    return attackCells.includes(target.index);
  }

  public getTargetCells(fighter: Unit, abilityClass: string, attackCells: number[]): number[] {
    let cells = [];
    const abilityData = fighter.getAbilityByClass(abilityClass);
    switch (abilityData.abilityType) {
      case ABILITY_TYPE_JUMP:
      case ABILITY_TYPE_DE_BUFF:
      case ABILITY_TYPE_ATTACK: {
        // Enemies
        cells = this._ctrl.game.getEnemySquadByFighter(fighter).map(fighter => fighter.index);
        break;
      }
      case ABILITY_TYPE_HEALING:
      case ABILITY_TYPE_BUFF: {
        // Allies
        cells = this._ctrl.game.getSquadByFighter(fighter).map(fighter => fighter.index);
        break;
      }
      case ABILITY_TYPE_SELF_BUFF: {
        // Self
        cells = [fighter.index];
        break;
      }
    }
    return _.intersection(attackCells, cells);
  }

  public getMoveAttackCells(fighter: Unit, abilityClass: string, canMove: boolean, onlyTargets: boolean): number[] {
    const abilityData = fighter.getAbilityByClass(abilityClass);
    const abilityStat = fighter.getAbilityStat(abilityClass);
    if (!abilityStat.attackRange) {
      return [];
    }

    let attackCells = this._ctrl.game.movement.getMoveAttackCells(
      fighter.index, 
      canMove ? abilityStat.moveRange : 0,
      abilityStat.attackRange
    );

    if (fighter.hasAgro) {
      const agroTargets = fighter.agroTargets;
      const cellsNotAllowedToAttack = this._ctrl.game.getEnemySquadByFighter(fighter)
        .filter(fighter => !agroTargets.includes(fighter.fighterId))
        .map(fighter => fighter.index);
      attackCells = _.difference(cellsNotAllowedToAttack, attackCells);
    }

    if (onlyTargets) {
      let targetCells = [];
      switch (abilityData.abilityType) {
        case ABILITY_TYPE_JUMP:
        case ABILITY_TYPE_DE_BUFF:
        case ABILITY_TYPE_ATTACK: {
          // Enemies
          targetCells = this._ctrl.game.getEnemySquadByFighter(fighter).map(fighter => fighter.index);
          break;
        }
        case ABILITY_TYPE_HEALING:
        case ABILITY_TYPE_BUFF: {
          // Allies
          targetCells = this._ctrl.game.getSquadByFighter(fighter).map(fighter => fighter.index);
          break;
        }
        case ABILITY_TYPE_SELF_BUFF: {
          // Self
          targetCells = [fighter.index];
          break;
        }
      }
      return _.intersection(attackCells, targetCells);
    } else {
      return attackCells;
    }
  }

  public tryApproachEnemy(fighter: Unit, target: Unit, abilityClass: string) {
    const attackCellsNoMoving =  this.getMoveAttackCells(fighter, abilityClass, false, true);
    // Need to approach
    if (!attackCellsNoMoving.includes(target.index)) {
      this.log("Need to approach the enemy");
      
      // Calc all the move cells
      const moveCells = this._ctrl.game.movement.getMoveCellsByAbility(fighter, abilityClass);
      
      // Iterate move cells to check if fighter can reach enemy from there
      const abilityStat = fighter.getAbilityStat(abilityClass);
      let canAttackFrom = [];
      moveCells.forEach(moveCell => {
        const attackPath = this._ctrl.game.movement.getPath(moveCell, target.index, false);
        if (attackPath.length < abilityStat.attackRange) {
          this.log("Attack path accepted (length=${attackPath.length} < attackRange=${abilityStat.attackRange})", { attackPath });
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
        this._ctrl.game.movement.moveFighter(fighter, ABILITY_MOVE, targetIndex);
        this.log(`Approaching enemy onto index ${targetIndex}`);
      }
    }
  }

  protected enableCooldown(fighter: Unit, abilityClass: string): void {
    if (![ABILITY_ATTACK, ABILITY_MOVE].includes(abilityClass)) {
      fighter.enableAbilityCooldown(abilityClass);
      this._ctrl.events.abilities(fighter.fighterId, fighter.abilities);
    }
  }
}
