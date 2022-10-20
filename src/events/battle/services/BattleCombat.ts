import _ from "lodash";
import { BattleCore } from "./BattleCore";
import { BattleService } from "./BattleService";
import { Fighter } from "../units/Fighter";
import {
  ABILITY_ATTACK,
  ABILITY_MOVE,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_TANK,
} from "../../../knightlands-shared/battle";
import { BattleBuff } from "../types";

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
    const abilityMeta = fighter.abilities.getMeta(abilityClass);

    // Check if unit is dead
    if (fighter.isStunned || fighter.isDead) {
      this.log("Fighter cannot attack. Abort.");
      return false;
    }

    // Allow movement
    if (abilityClass === ABILITY_MOVE) {
      return true;
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
        (!fighter.isEnemy &&
          abilityMeta.targetAllies &&
          target &&
          !target.isEnemy) ||
        (!fighter.isEnemy &&
          abilityMeta.targetEnemies &&
          target &&
          target.isEnemy) ||
        (fighter.isEnemy &&
          abilityMeta.targetAllies &&
          target &&
          target.isEnemy) ||
        (fighter.isEnemy &&
          abilityMeta.targetEnemies &&
          target &&
          !target.isEnemy) ||
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

  public acceptableRangeForAttack(
    fighter: Fighter,
    target: Fighter | null,
    abilityClass: string
  ): boolean {
    if (abilityClass === ABILITY_MOVE) {
      return false;
    }

    const abilityMeta = fighter.abilities.getMeta(abilityClass);
    const abilityData = fighter.abilities.getAbilityByClass(abilityClass);

    let attackCells = this._core.game.movement.getMoveAttackCells(
      fighter.index,
      abilityData.range.move,
      abilityData.range.attack,
      abilityMeta.ignoreObstacles,
      abilityMeta.ignoreTerrain
    );

    return attackCells.includes(target.index);
  }

  protected groupHeal(source: Fighter, abilityClass: string): void {
    this.log("Group heal", { abilityClass });
    const attackAreaData = this.getAttackAreaData(source, abilityClass);
    const targets = this._core.game.getSquadByFighter(source);
    targets.forEach((target) => {
      if (attackAreaData.targetCells.includes(target.index)) {
        this.heal(source, target, abilityClass);
      }
    });
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
  }

  public applyEffect(
    source: Fighter,
    target: Fighter,
    abilityClass: string
  ): void {
    if ([ABILITY_ATTACK, ABILITY_MOVE].includes(abilityClass)) {
      return;
    }

    this.log("Buff", { abilityClass });
    const abilityData = source.abilities.getAbilityByClass(abilityClass);
    const draws = abilityData.effects;
    if (!draws || !draws.length) {
      return;
    }

    const abilityMeta = source.abilities.getMeta(abilityClass);
    let buffsCount = 0;
    draws.forEach((draw) => {
      draw.forEach((effect) => {
        const buff = {
          name: effect.name,
          target: effect.target,
          subEffect: effect.subEffect,
          operation: effect.operation,
          probability: effect.probability,
          value: effect.value,
          duration: effect.duration,
          source: "pvp",
          sourceId: abilityClass,
          mode: "constant",
          activated: false,
          caseId: abilityData.levelInt - 1,
        } as BattleBuff;

        if (buff.subEffect === "agro") {
          buff.targetFighterId = source.fighterId;
        }

        target.buffs.addBuff(buff);
        buffsCount++;
      });
    });

    if (!buffsCount) return;

    this._core.events.effect({
      action: abilityMeta.targetEnemies
        ? "de_buff"
        : abilityMeta.targetSelf
        ? "self_buff"
        : "buff",
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
  }

  public handleHpChange(
    fighter: Fighter,
    target: Fighter | null,
    abilityClass: string
  ): void {
    if (abilityClass === ABILITY_MOVE) {
      return;
    }
    const abilityMeta = fighter.abilities.getMeta(abilityClass);
    if (abilityMeta.targetEnemies) {
      this.attack(fighter, target, abilityClass);
    } else if (abilityMeta.targetAllies && !abilityMeta.affectFullSquad) {
      this.heal(fighter, target, abilityClass);
    } else if (abilityMeta.targetAllies && abilityMeta.affectFullSquad) {
      this.groupHeal(fighter, abilityClass);
    }
  }

  protected attack(
    source: Fighter,
    target: Fighter,
    abilityClass: string
  ): void {
    this.log("Attack", { abilityClass });

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
  }

  protected attackCallback(target: Fighter) {
    target.attackCallback();
  }

  public getAttackAreaData(
    fighter: Fighter,
    abilityClass: string
  ): {
    attackCells: number[];
    targetCells: number[];
  } {
    const abilityData = fighter.abilities.getAbilityByClass(abilityClass);
    const abilityMeta = fighter.abilities.getMeta(abilityClass);

    //console.log('Ability stat', abilityStat);
    if (!abilityData.range.attack) {
      return {
        attackCells: [],
        targetCells: [],
      };
    }

    let attackCells = this._core.game.movement.getMoveAttackCells(
      fighter.index,
      abilityData.range.move,
      abilityData.range.attack,
      abilityMeta.ignoreObstacles,
      abilityMeta.ignoreTerrain
    );

    let targetCells = [];
    if (abilityMeta.targetEnemies) {
      targetCells.push(
        ...this._core.game
          .getEnemySquadByFighter(fighter)
          .map((fighter) => fighter.index)
      );
    } else if (abilityMeta.targetAllies) {
      targetCells.push(
        ...this._core.game
          .getSquadByFighter(fighter)
          .map((fighter) => fighter.index)
      );
    } else if (abilityMeta.targetSelf) {
      targetCells.push(fighter.index);
    }

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

    attackCells = _.uniq(attackCells);
    targetCells = _.uniq(targetCells);

    return { attackCells, targetCells };
  }

  public tryApproachEnemy(
    fighter: Fighter,
    target: Fighter,
    abilityClass: string
  ) {
    // Only melee and tanks can move during attack
    if (![UNIT_CLASS_MELEE, UNIT_CLASS_TANK].includes(fighter.unit.class)) {
      return;
    }

    // Calc all the move cells
    const moveCells = this._core.game.movement.getMoveCellsByAbility(
      fighter,
      abilityClass,
      false
    );

    // Iterate move cells to check if fighter can reach enemy from there
    const abilityData = fighter.abilities.getAbilityByClass(abilityClass);
    let canAttackFrom = [];
    moveCells[fighter.index] = 0;
    for (let moveCell in moveCells) {
      let movePathLength = moveCells[moveCell];
      // Calc attack path
      // TODO test zero range
      const attackPath = this._core.game.movement.getPath(
        parseInt(moveCell),
        target.index,
        true
      );
      if (attackPath.length + 1 <= abilityData.range.attack) {
        this.log(
          "Attack path accepted (length=${attackPath.length} < attackRange=${abilityStat.attackRange})",
          { attackPath }
        );
        canAttackFrom.push({
          index: parseInt(moveCell),
          totalRange: attackPath.length + 1 + movePathLength
        });
      }
    }

    // Have spots to approach
    if (canAttackFrom.length) {
      // Move to attack spot
      const targetIndex = _.head(_.sortBy(canAttackFrom, "totalRange"));
      this._core.game.movement.moveFighter(fighter, ABILITY_MOVE, targetIndex.index);
      this.log(`Approaching enemy onto index ${targetIndex}`);
    }
  }

  public enableCooldown(fighter: Fighter, abilityClass: string): void {
    if (![ABILITY_ATTACK, ABILITY_MOVE].includes(abilityClass)) {
      fighter.abilities.enableAbilityCooldown(abilityClass);
      this._core.events.abilities(
        fighter.fighterId,
        fighter.abilities.serialize()
      );
    }
  }
}
