import _ from "lodash";
import game from "../../../game";
import { BattleCore } from "./BattleCore";
import { BattleService } from "./BattleService";
import { Fighter } from "../units/Fighter";
import { BattleAbilityMeta } from "../units/MetaDB";
import {
  ABILITY_ATTACK,
  ABILITY_MOVE,
} from "../../../knightlands-shared/battle";

export class BattleCombat extends BattleService {
  protected _core: BattleCore;

  constructor(core: BattleCore) {
    super();
    this._core = core;
  }

  public canApply(
    fighter: Fighter,
    target: Fighter | null,
    abilityClass: string
  ): boolean {
    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);

    // Check if unit is dead
    if (fighter.isStunned || fighter.isDead) {
      this.log("Fighter cannot attack. Abort.");
      return false;
    }

    // Check if unit can use ability
    if (!fighter.abilities.canUseAbility(abilityClass)) {
      this.log("Fighter cannot use this ability. Abort.");
      return false;
    }

    // Check if target is dead
    if (abilityMeta.affectHp && target && target.isDead) {
      this.log("Target is dead. Abort.");
      return false;
    }

    // Check target restrictions
    if (
      !(
        (abilityMeta.targetAllies && target && !target.isEnemy) ||
        (abilityMeta.targetEnemies && target && target.isEnemy) ||
        (abilityMeta.targetSelf &&
          target &&
          target.fighterId === fighter.fighterId) ||
        (abilityMeta.targetEmptyCell && !target)
      )
    ) {
      this.log("Wrong target type. Abort.");
      return false;
    }

    return true;
  }

  // TODO update
  public acceptableRange(
    fighter: Fighter,
    target: Fighter | null,
    abilityClass: string
  ): boolean {
    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);
    const abilityStat = fighter.abilities.getAbilityStat(abilityClass);
    let attackCells = this._core.game.movement.getMoveAttackCells(
      fighter.index,
      abilityMeta.canMove ? abilityStat.moveRange : 0,
      abilityStat.attackRange,
      abilityStat.ignoreObstacles
    );

    return true;
  }

  // TODO update
  public shouldMove(
    fighter: Fighter,
    target: Fighter | null,
    abilityClass: string
  ): boolean {
    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);
    // TODO check if target within attack range
    return abilityMeta.canMove;
  }

  protected groupHeal(source: Fighter, abilityClass: string): void {
    this.log("Group heal", { abilityClass });
    const attackAreaData = this.getAttackAreaData(source, abilityClass, false);
    const targets = this._core.game.getSquadByFighter(source);
    targets.forEach((target) => {
      if (attackAreaData.targetCells.includes(target.index)) {
        this.heal(source, target, abilityClass);
      }
    });
    this.enableCooldown(source, abilityClass);
  }

  protected heal(source: Fighter, target: Fighter, abilityClass: string): void {
    this.log("Heal", { abilityClass });
    const abilityData = source.abilities.getAbilityByClass(abilityClass);
    const oldHp = target.hp;
    target.modifyHp(+abilityData.value);

    this._core.events.effect({
      action: "healing",
      source: {
        fighterId: source.fighterId,
        index: source.index,
      },
      target: {
        fighterId: target.fighterId,
        index: target.index,
        oldHp,
        newHp: target.hp,
      },
      ability: {
        abilityClass,
        value: abilityData.value,
        criticalHit: false,
      },
    });

    this.enableCooldown(source, abilityClass);
  }

  public buff(source: Fighter, target: Fighter, abilityClass: string): void {
    this.log("Buff", { abilityClass });
    const abilityStat = source.abilities.getAbilityStat(abilityClass);
    const effects = abilityStat.effects;
    if (!effects) {
      throw Error(`Buff ${abilityClass} has no effects`);
    }

    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);
    const abilityData = source.abilities.getAbilityByClass(abilityClass);
    effects.forEach((effect) => {
      const caseId = abilityData.levelInt;
      const buff = {
        source: "buff",
        sourceId: abilityClass,
        ...effect,
        caseId,
      };
      if (effect.type === "agro") {
        buff.targetFighterId = source.fighterId;
      }
      // TODO update
      /*if (!effect.estimate && abilityMeta.duration) {
        buff.estimate = _.clone(abilityMeta.duration);
      }*/
      target.buffs.addBuff(buff);
    });

    this._core.events.effect({
      action: abilityMeta.targetEnemies ? 'de_buff' : (abilityMeta.targetSelf ? 'self_buff' : 'buff'),
      source: {
        fighterId: source.fighterId,
        index: source.index,
      },
      target: {
        fighterId: target.fighterId,
        index: target.index,
      },
      ability: {
        abilityClass,
      },
    });

    this.enableCooldown(source, abilityClass);
  }

  public handleHpChange(
    fighter: Fighter,
    target: Fighter | null,
    abilityClass: string
  ): void {
    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);
    if (abilityMeta.targetEnemies) {
      this.attack(fighter, target, abilityClass);
    } else if (abilityMeta.targetAllies && !abilityMeta.affectFullSquad) {
      this.heal(fighter, target, abilityClass);
    } else if (abilityMeta.targetAllies && abilityMeta.affectFullSquad) {
      this.groupHeal(fighter, abilityClass);
    }
  }

  protected attack(source: Fighter, target: Fighter, abilityClass: string): void {
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
    const percentBlocked =
      (100 * (defBase * 0.05)) / (1 + defBase * 0.05) / 100;
    const damage = Math.round(dmgBase * (1 - percentBlocked));

    this.log("Attack details", {
      source: source.fighterId,
      target: target.fighterId,
      abilityClass,
      dmgBase,
      defBase,
      percentBlocked,
      damage,
    });

    const oldHp = target.hp;
    target.modifyHp(-damage);
    if (!target.isDead) {
      this.attackCallback(target);
    }

    this._core.events.effect({
      action: "attack",
      source: {
        fighterId: source.fighterId,
        index: source.index,
      },
      target: {
        fighterId: target.fighterId,
        index: target.index,
        oldHp,
        newHp: target.hp,
      },
      ability: {
        abilityClass,
        damage,
        criticalHit: false,
      },
    });

    this.enableCooldown(source, abilityClass);
  }

  protected attackCallback(target: Fighter) {
    target.attackCallback();
  }

  public getTargetCells(
    fighter: Fighter,
    abilityClass: string,
    attackCells: number[]
  ): number[] {
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

  public getAttackAreaData(
    fighter: Fighter,
    abilityClass: string,
    canMove: boolean
  ): {
    attackCells: number[];
    targetCells: number[];
  } {
    const abilityData = fighter.abilities.getAbilityByClass(abilityClass);
    const abilityStat = fighter.abilities.getAbilityStat(abilityClass);
    //console.log('Ability stat', abilityStat);
    if (!abilityStat.attackRange) {
      return {
        attackCells: [],
        targetCells: [],
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
      const cellsNotAllowedToAttack = this._core.game
        .getEnemySquadByFighter(fighter)
        .filter((fighter) => !agroTargets.includes(fighter.fighterId))
        .map((fighter) => fighter.index);

      targetCells = targetCells.filter(
        (i) => !cellsNotAllowedToAttack.includes(i)
      );
      this.log(`Fighter #${fighter.fighterId} has agro`, { targetCells });
    }

    return { attackCells, targetCells };
  }

  public tryApproachEnemy(
    fighter: Fighter,
    target: Fighter,
    abilityClass: string
  ) {
    const attackAreaNoMoving = this.getAttackAreaData(
      fighter,
      abilityClass,
      false
    );
    // Need to approach
    if (!attackAreaNoMoving.targetCells.includes(target.index)) {
      this.log("Need to approach the enemy");

      // Calc all the move cells
      const moveCells = this._core.game.movement.getMoveCellsByAbility(
        fighter,
        abilityClass
      );

      // Iterate move cells to check if fighter can reach enemy from there
      const abilityStat = fighter.abilities.getAbilityStat(abilityClass);
      let canAttackFrom = [];
      moveCells.forEach((moveCell) => {
        const attackPath = this._core.game.movement.getPath(
          moveCell,
          target.index,
          true
        );
        if (attackPath.length < abilityStat.attackRange) {
          this.log(
            "Attack path accepted (length=${attackPath.length} < attackRange=${abilityStat.attackRange})",
            { attackPath }
          );
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
        this._core.game.movement.moveFighter(
          fighter,
          ABILITY_MOVE,
          targetIndex
        );
        this.log(`Approaching enemy onto index ${targetIndex}`);
      }
    }
  }

  protected enableCooldown(fighter: Fighter, abilityClass: string): void {
    if (![ABILITY_ATTACK, ABILITY_MOVE].includes(abilityClass)) {
      fighter.abilities.enableAbilityCooldown(abilityClass);
      this._core.events.abilities(
        fighter.fighterId,
        fighter.abilities.serialize()
      );
    }
  }
}
