import _ from "lodash";
import { ABILITY_ATTACK, ABILITY_DASH, ABILITY_FLIGHT, ABILITY_RUSH, ABILITY_TELEPORTATION, ABILITY_TYPES, ABILITY_TYPE_ATTACK, ABILITY_TYPE_BUFF, ABILITY_TYPE_HEALING, ABILITY_TYPE_JUMP, UNIT_CLASS_MAGE, UNIT_CLASS_MELEE, UNIT_CLASS_RANGE, UNIT_CLASS_SUPPORT, UNIT_CLASS_TANK } from "../../../knightlands-shared/battle";
import { BattleController } from "../BattleController";
import { SETTINGS } from "../meta";
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

    const abilityData = source.getAbilityByClass(abilityClass);
    const value = abilityData.value;
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

  public buff(source: Unit, target: Unit, abilityClass: string): void {
    if (!this.canAffect(source, target, abilityClass)) {
      return;
    }
    
    // Adjust characteristics
    // Apply squad bonuses
    const abilityData = source.getAbilityByClass(abilityClass);
    if (!abilityData) {
      return;
    }

    return;

    //const buff = BUFFS[abilityClass][abilityData.level];
    
    // TODO test
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

    const abilityData = source.getAbilityByClass(abilityClass);
    const damageModifier = this.getModifier(
      abilityClass === ABILITY_ATTACK ? "attack" : "abilities", 
      source
    );
    const dmgBase = (abilityClass === ABILITY_ATTACK ? source.damage : abilityData.value) * damageModifier;
    const defenceModifier = this.getModifier("defence", target);
    const defBase = target.defence * defenceModifier;
    const percentBlocked = (100*(defBase*0.05))/(1+(defBase*0.05))/100;
    const damage = Math.round(dmgBase * (1 - percentBlocked));

    console.log("[Combat] Attack", {
      dmgBase,
      damageModifier,
      defBase,
      defenceModifier,
      percentBlocked,
      damage
    });

    const oldHp = target.hp;
    target.modifyHp(-damage);
    this._ctrl.game.chekIfFighterIsDead(target);
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
    // TODO Defence stack
    // TODO Counter attack
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
        if (abilityClass === ABILITY_FLIGHT || abilityClass === ABILITY_ATTACK) {
          return { range: 2, scheme: SETTINGS.jumpScheme };
        } else {
          return { range: 1, scheme: SETTINGS.attackScheme };
        }
      }
      case UNIT_CLASS_RANGE: {
        if (abilityClass === ABILITY_DASH) {
          return { range: fighter.speed + 2, scheme: SETTINGS.jumpScheme };
        } else if (abilityClass === ABILITY_ATTACK) {
          return { range: 2, scheme: SETTINGS.attackScheme };
        } else {
          return { range: 1, scheme: SETTINGS.attackScheme };
        }
      }
      case UNIT_CLASS_TANK: {
        switch (abilityClass) {
          case ABILITY_ATTACK: {
            return { range: 1, scheme: SETTINGS.attackScheme };
          }
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

  public canAffect(source: Unit, target: Unit, abilityClass: string): boolean {
    const attackCells = this.getAttackCells(source, abilityClass, true);
    return attackCells.includes(target.index);
  }

  public getAttackCells(fighter: Unit, abilityClass: string, onlyTargets: boolean): number[] {
    const rangeData = this.getRangeAndScheme(fighter, abilityClass);
    const abilityType = ABILITY_TYPES[abilityClass];
    const rangeCells = this._ctrl.game.movement.getRangeCells(
      abilityType === ABILITY_TYPE_JUMP ? "jump" : "attack", 
      fighter.index,
      rangeData.range,
      rangeData.scheme
    );

    if (onlyTargets) {
      const enemyCells = this._ctrl.game.relativeEnemySquad.map(unit => unit.index);
      console.log("[Combat] Relative enemy indexes", enemyCells);
      return _.intersection(rangeCells, enemyCells);
    } else {
      return rangeCells;
    }
  }

  // TODO modifiers
  protected getModifier(type: string, fighter: Unit): number {
    switch (type) {
      // Damage
      case "power": {
      }
      case "attack": {
      }
      case "abilities": {
      }
      case "crit": {
      }
      
      // Characteristics
      case "speed": {
      }
      case "defence": {
      }
      case "hp": {
      }
      case "speed": {
      }
      
      // Terrain
      case "lava_damage": {
      }
    }
    
    return 1;
  }
}
