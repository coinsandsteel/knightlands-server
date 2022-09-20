import _ from "lodash";
import { ABILITY_ATTACK, ABILITY_MOVE, ABILITY_TYPE_ATTACK, ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF, ABILITY_TYPE_HEALING, ABILITY_TYPE_JUMP, ABILITY_TYPE_SELF_BUFF } from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import { Unit } from "../units/Unit";
import { BattleService } from "./BattleService";
import game from "../../../game";

export class BattleCombat extends BattleService {
  protected _core: BattleCore;

  constructor(core: BattleCore) {
    super();
    this._core = core;
  }

  public groupHeal(source: Unit, abilityClass: string): void {
    this.log("Group heal", { abilityClass });
    const attackAreaData = this.getAttackAreaData(source, abilityClass, false);
    const targets = this._core.game.getSquadByFighter(source);
    targets.forEach(target => {
      if (attackAreaData.targetCells.includes(target.index)) {
        this.heal(source, target, abilityClass);
      }
    });

    this.enableCooldown(source, abilityClass);
  }

  public heal(source: Unit, target: Unit, abilityClass: string): void {
    this.log("Heal", { abilityClass });
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }

    const abilityData = source.abilities.getAbilityByClass(abilityClass);
    const oldHp = target.hp;
    target.modifyHp(+abilityData.value);

    this._core.events.effect({
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

  public buff(source: Unit, target: Unit, abilityClass: string, preventAttack?: boolean): void {
    this.log("Buff", { abilityClass });
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }
    
    const abilityStat = source.abilities.getAbilityStat(abilityClass);
    const effects = abilityStat.effects;
    if (!effects) {
      throw Error(`Buff ${abilityClass} has no effects`);
    }

    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);
    const abilityData = source.abilities.getAbilityByClass(abilityClass);
    effects.forEach(effect => {
      const caseId = abilityData.levelInt;
      const buff = {
        source: 'buff',
        sourceId: abilityClass,
        ...effect,
        caseId
      };
      if (effect.type === "agro") {
        buff.targetFighterId = source.fighterId;
      }
      // TODO update
      /*if (!effect.estimate && abilityMeta.duration) {
        buff.estimate = _.clone(abilityMeta.duration);
      }*/
      target.addBuff(buff);
    });

    // TODO update

    // Buff + damage
    // ABILITY_STUN	-1
    // ABILITY_STUN_SHOT -1
    // ABILITY_SHIELD_STUN -1
    /*if (!preventAttack && abilityMeta.damageScheme === -1) {
      this.attack(source, target, abilityClass, true);
    } else {
      
      this._core.events.effect({
        action: abilityMeta.abilityType,
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
    }*/

    this.enableCooldown(source, abilityClass);
  }

  public attack(source: Unit, target: Unit, abilityClass: string, preventBuff?: boolean): void {
    this.log("Attack", { abilityClass });
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }

    const abilityData = source.abilities.getAbilityByClass(abilityClass);
    const dmgBase = abilityData.value;
    if (!_.isNumber(dmgBase)) {
      this.log("[Error data]", { abilityData });
      throw Error("dmgBase value is not a number. Abort.");
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
      const abilityStat = source.abilities.getAbilityStat(abilityClass);
      if (!preventBuff && abilityStat.effects.length) {
        this.buff(source, target, abilityClass, true);
      }
    }

    this._core.events.effect({
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
    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);
    if (abilityMeta.targetSelf && source.fighterId === target.fighterId) {
      return true;
    }
    const attackAreaData = this.getAttackAreaData(source, abilityClass, false);
    return attackAreaData.targetCells.includes(target.index);
  }

  public getTargetCells(fighter: Unit, abilityClass: string, attackCells: number[]): number[] {
    let cells = [];
    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);
    // TODO update
    /*switch (abilityMeta.type) {
      case ABILITY_TYPE_JUMP:
      case ABILITY_TYPE_DE_BUFF:
      case ABILITY_TYPE_ATTACK: {
        // Enemies
        cells = this._core.game.getEnemySquadByFighter(fighter).map(fighter => fighter.index);
        break;
      }
      case ABILITY_TYPE_HEALING:
      case ABILITY_TYPE_BUFF: {
        // Allies
        cells = this._core.game.getSquadByFighter(fighter).map(fighter => fighter.index);
        break;
      }
      case ABILITY_TYPE_SELF_BUFF: {
        // Self
        cells = [fighter.index];
        break;
      }
    }*/
    return _.intersection(attackCells, cells);
  }

  public getAttackAreaData(fighter: Unit, abilityClass: string, canMove: boolean): { 
    attackCells: number[], 
    targetCells: number[] 
  } {
    const abilityData = fighter.abilities.getAbilityByClass(abilityClass);
    const abilityStat = fighter.abilities.getAbilityStat(abilityClass);
    //console.log('Ability stat', abilityStat);
    if (!abilityStat.attackRange) {
      return {
        attackCells: [],
        targetCells: []
      };
    }

    let attackCells = this._core.game.movement.getMoveAttackCells(
      fighter.index, 
      canMove ? abilityStat.moveRange : 0,
      abilityStat.attackRange,
      abilityStat.ignoreObstacles
    );

    let targetCells = [];
    // TODO update
    /*switch (abilityData.abilityType) {
      case ABILITY_TYPE_JUMP:
      case ABILITY_TYPE_DE_BUFF:
      case ABILITY_TYPE_ATTACK: {
        // Enemies
        targetCells = this._core.game.getEnemySquadByFighter(fighter).map(fighter => fighter.index);
        break;
      }
      case ABILITY_TYPE_HEALING:
      case ABILITY_TYPE_BUFF: {
        // Allies
        targetCells = this._core.game.getSquadByFighter(fighter).map(fighter => fighter.index);
        break;
      }
      case ABILITY_TYPE_SELF_BUFF: {
        // Self
        targetCells = [fighter.index];
        break;
      }
    }*/
    targetCells = _.intersection(attackCells, targetCells);

    if (fighter.hasAgro) {
      const agroTargets = fighter.agroTargets;
      const cellsNotAllowedToAttack = this._core.game.getEnemySquadByFighter(fighter)
        .filter(fighter => !agroTargets.includes(fighter.fighterId))
        .map(fighter => fighter.index);

      targetCells = targetCells.filter(i => !cellsNotAllowedToAttack.includes(i));
      this.log(`Fighter #${fighter.fighterId} has agro`, { targetCells });
    }

    return { attackCells, targetCells };
  }

  public tryApproachEnemy(fighter: Unit, target: Unit, abilityClass: string) {
    const attackAreaNoMoving =  this.getAttackAreaData(fighter, abilityClass, false);
    // Need to approach
    if (!attackAreaNoMoving.targetCells.includes(target.index)) {
      this.log("Need to approach the enemy");
      
      // Calc all the move cells
      const moveCells = this._core.game.movement.getMoveCellsByAbility(fighter, abilityClass);
      
      // Iterate move cells to check if fighter can reach enemy from there
      const abilityStat = fighter.abilities.getAbilityStat(abilityClass);
      let canAttackFrom = [];
      moveCells.forEach(moveCell => {
        const attackPath = this._core.game.movement.getPath(moveCell, target.index, true);
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
        this._core.game.movement.moveFighter(fighter, ABILITY_MOVE, targetIndex);
        this.log(`Approaching enemy onto index ${targetIndex}`);
      }
    }
  }

  protected enableCooldown(fighter: Unit, abilityClass: string): void {
    if (![ABILITY_ATTACK, ABILITY_MOVE].includes(abilityClass)) {
      fighter.abilities.enableAbilityCooldown(abilityClass);
      this._core.events.abilities(fighter.fighterId, fighter.abilities.serialize());
    }
  }
}
