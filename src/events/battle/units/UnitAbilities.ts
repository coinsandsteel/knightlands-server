import _ from "lodash";
import {
  ABILITY_ATTACK,
  ABILITY_MOVE,
  ABILITY_TYPE_ATTACK,
  ABILITY_TYPE_SELF_BUFF,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_TANK,
} from "../../../knightlands-shared/battle";
import { ABILITY_LEVEL_UP_PRICES, ABILITY_SCHEME, SETTINGS } from "../meta";
import { BattleLevelScheme, BattleUnitAbility } from "../types";
import { Unit } from "./Unit";
import game from "../../../game";
import { BattleAbilityMeta } from "./MetaDB";

export default class UnitAbilities {
  protected readonly _unit: Unit;
  protected _abilities: BattleUnitAbility[];
  protected _dependencies: {
    damage: number;
    speed: number;
  };

  get abilities(): BattleUnitAbility[] {
    return this._abilities;
  }

  constructor(unit: Unit, abilities: BattleUnitAbility[]) {
    this._unit = unit;
    this._dependencies = {
      damage: unit.damage,
      speed: unit.speed,
    };

    this._abilities = abilities;
    if (
      !this._abilities.find((entry) => entry.abilityClass === ABILITY_ATTACK)
    ) {
      this._abilities.unshift(
        UnitAbilities.createEmptyBlueprint(ABILITY_ATTACK)
      );
    }
  }

  public static createEmptyBlueprint(abilityClass: string): BattleUnitAbility {
    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);
    const blueprint = {
      abilityClass,
      abilityType: null,
      tier:
        abilityClass === ABILITY_ATTACK
          ? 1
          : abilityMeta
          ? abilityMeta.tier
          : 1,
      levelInt: abilityClass === ABILITY_ATTACK ? 1 : 0,
      level: {
        current: abilityClass === ABILITY_ATTACK ? 1 : 0,
        next: null,
        price: null,
      } as BattleLevelScheme,
      value: 0,
      combatValue: 0,
      enabled: abilityClass === ABILITY_ATTACK,
      range: {
        move: 0,
        attack: 0,
      },
      effects: [],
      targets:
        abilityClass === ABILITY_ATTACK
          ? {
              targetEnemies: true,
              targetAllies: false,
              targetSelf: false,
              targetEmptyCell: false,
            }
          : _.pick(abilityMeta, [
              "targetEnemies",
              "targetAllies",
              "targetSelf",
              "targetEmptyCell",
            ]),
    } as BattleUnitAbility;
    return blueprint;
  }

  public update(dependencies?: { damage: number; speed: number }): void {
    if (dependencies) {
      this._dependencies.damage = dependencies.damage;
      this._dependencies.speed = dependencies.speed;
    }

    this.unlock();

    this._abilities = this._abilities.map((entry) =>
      this.calcAbility(entry.abilityClass)
    );
  }

  public getMeta(abilityClass: string) {
    if (abilityClass === ABILITY_MOVE) {
      return null;
    }

    if (abilityClass === ABILITY_ATTACK) {
      const isTankOrMelee = [UNIT_CLASS_TANK, UNIT_CLASS_MELEE].includes(
        this._unit.class
      );

      return {
        _id: 0,
        abilityClass: ABILITY_ATTACK,
        abilityType: ABILITY_TYPE_ATTACK,
        tier: 1,
        affectHp: true,
        affectFullSquad: false,
        canMove: isTankOrMelee,

        baseMultiplier: 0,
        finalMultiplier: 0,
        levelStep: 0,

        targetEnemies: true,
        targetAllies: false,
        targetSelf: false,
        targetEmptyCell: false,

        ignoreTerrain: false,
        ignoreTerrainPenalty: false,
        ignoreObstacles: false,

        effectList: [],
        effects: [],

        range: [
          {
            move: { value: 0, addSpeed: isTankOrMelee },
            attack: { value: isTankOrMelee ? 1 : 0, addSpeed: !isTankOrMelee },
          },
        ],
      } as BattleAbilityMeta;
    }

    return game.battleManager.loadAbilityMeta(abilityClass);
  }

  protected getAbilityValue(ability: string): number | null {
    if (ability === ABILITY_MOVE) {
      return null;
    }

    if (ability === ABILITY_ATTACK) {
      return this._dependencies.damage;
    }

    const abilityData = this.getAbilityByClass(ability);
    const abilityMeta = this.getMeta(ability);
    const classMeta = game.battleManager.getClassMeta(this._unit.class);

    // ClassDamage * (BaseMultiplier + LevelStep * (AbilityLevel-1))) * FinalMultiplier
    const abilityValue =
      SETTINGS.damageModifier *
      classMeta.damage *
      (abilityMeta.baseMultiplier +
        abilityMeta.levelStep * (abilityData.levelInt - 1)) *
      abilityMeta.finalMultiplier *
      (this._unit.isBoss ? SETTINGS.bossPower : 1);

    return Math.round(abilityValue);
  }

  protected getAbilityCombatValue(ability: string): number | null {
    if (ability === ABILITY_MOVE) {
      return null;
    }
    if (ability === ABILITY_ATTACK) {
      return this._dependencies.damage;
    }
    const abilityMeta = this.getMeta(ability);
    const abilityData = this.getAbilityByClass(ability);
    if (!abilityMeta.affectHp) {
      const effects = abilityData.effects;
      if (effects && effects.length && effects[0] && effects[0].length) {
        return effects[0][0].value;
      }
    }
    return null;
  }

  public enableAbilityCooldown(abilityClass: string): void {
    this._abilities.forEach((abilityEntry) => {
      if (
        abilityEntry.abilityClass === abilityClass &&
        abilityEntry.enabled &&
        (!abilityEntry.cooldown || !abilityEntry.cooldown.enabled)
      ) {
        const abilityScheme =
          ABILITY_SCHEME[this._unit.levelInt - 1][abilityEntry.tier - 1];

        /*if (!abilityScheme) {
          console.log("[UnitAbilities] enableAbilityCooldown", {
            unitLevel: this._unit.levelInt,
            abilityEntry,
            abilityScheme,
          });
        }*/

        abilityEntry.cooldown = {
          enabled: true,
          estimate: abilityScheme.cd,
        };
        /*console.log(
          `Ability "${abilityClass}" cooldown has been set`,
          abilityEntry.cooldown
        );*/
      }
    });
  }

  public decreaseAbilitiesCooldownEstimate(): void {
    this._abilities.forEach((ability) => {
      if (ability.cooldown && ability.cooldown.estimate > 0) {
        ability.cooldown.estimate--;

        if (ability.cooldown.estimate === 0) {
          ability.cooldown.enabled = false;
        }

        /*console.log(
          `Ability "${ability.abilityClass}" cooldown`,
          ability.cooldown
        );*/
      }
    });
  }

  protected calcAbility(abilityClass: string): BattleUnitAbility | null {
    if (abilityClass === ABILITY_MOVE) {
      throw new Error(
        'Cannot calc "move" ability stats. No stats were implemented'
      );
    }

    const abilityData = this.getAbilityByClass(abilityClass);
    const abilityMeta = this.getMeta(abilityClass);

    const value = this.getAbilityValue(abilityClass);
    const combatValue = this.getAbilityCombatValue(abilityClass);
    const range = abilityMeta.range[abilityData.levelInt - 1];

    const moveRange = abilityData.enabled
      ? range.move.value + (range.move.addSpeed ? this._dependencies.speed : 0)
      : 0;

    const attackRange = abilityData.enabled
      ? range.attack.value +
        (range.attack.addSpeed ? this._dependencies.speed : 0)
      : 0;

    const effects = abilityMeta.effects.length
      ? abilityMeta.effects[
          abilityData.levelInt === 0 ? 0 : abilityData.levelInt - 1
        ]
      : [];

    const ability = {
      ...abilityData,
      abilityType: abilityMeta.abilityType,
      value,
      combatValue: abilityMeta.affectHp
        ? value
        : effects.length
        ? combatValue
        : null,
      range: {
        move: abilityMeta.canMove ? (moveRange < 0 ? 0 : moveRange) : 0,
        attack: attackRange < 0 ? 0 : attackRange,
      },
      effects,
    };

    return ability;
  }

  public movingOnly(abilityClass: string): boolean {
    if (abilityClass === ABILITY_MOVE) {
      return true;
    }
    const abilityMeta = this.getMeta(abilityClass);
    return abilityMeta.canMove && abilityMeta.targetEmptyCell;
  }

  public serialize(): BattleUnitAbility[] {
    return this._abilities.map((ability) => {
      const abilityMeta = this.getMeta(ability.abilityClass);
      const twoStepActivation =
        (abilityMeta.targetSelf && !abilityMeta.targetEnemies && !abilityMeta.targetEmptyCell) || abilityMeta.affectFullSquad;
      return {
        abilityClass: ability.abilityClass,
        abilityType: ability.abilityType,
        tier: ability.tier,
        levelInt: ability.levelInt,
        level: ability.level,
        value: ability.value,
        combatValue: ability.combatValue,
        enabled: ability.enabled,
        range: ability.range,
        cooldown: {
          enabled: ability.cooldown ? ability.cooldown.enabled : false,
          estimate: ability.cooldown ? ability.cooldown.estimate : 0,
        },
        effects: ability.effects,
        targets: ability.targets,
        twoStepActivation
      } as BattleUnitAbility;
    });
  }

  public unlock(): void {
    this._abilities.forEach((ability) => {
      if (ability.abilityClass === ABILITY_ATTACK) {
        return;
      }

      const abilityScheme =
        ABILITY_SCHEME[this._unit.levelInt - 1][ability.tier - 1];

      /*console.log("[UnitAbilities] Trying to unlock", {
        unitName: this._unit.name,
        abilityScheme: !!abilityScheme,
        unitLevel: this._unit.levelInt,
        abilityTier: ability.tier,
      });*/

      if (abilityScheme) {
        // Unlock ability
        if (ability.level.current === 0) {
          ability.enabled = true;
          ability.level.current = 1;
          ability.levelInt = 1;
          //console.log(`Ability enabled`, ability);
        }

        const canUpgradeMore = ability.level.current < abilityScheme.lvl;
        ability.level.next = canUpgradeMore ? ability.level.current + 1 : null;
        ability.level.price = canUpgradeMore
          ? this.getAbilityUpgradePrice(ability.tier, ability.level.next)
          : null;

        if (canUpgradeMore) {
          /*console.log(
            `Ability allowed to upgrade to ${abilityScheme.lvl} lvl`,
            ability
          );*/
        }
      }
    });
  }

  public setAbilityLevel(abilityClass: string, level: number): void {
    if ([ABILITY_MOVE, ABILITY_ATTACK].includes(abilityClass)) {
      return;
    }
    if (level < 1) {
      level = 1;
    }

    const ability = this._abilities.find(ability => ability.abilityClass === abilityClass);
    if (!ability) {
      throw new Error('No such ability!');
    }

    const abilityScheme = ABILITY_SCHEME[this._unit.levelInt - 1][ability.tier - 1];
    if (!abilityScheme) {
      return;
    }

    // Fallback to highest lvl
    level = Math.min(level, abilityScheme.lvl);

    ability.enabled = !!level;
    ability.level = {
      current: level,
      next: null,
      price: null,
    };
    ability.levelInt = level;
    ability.level.next = null;
    ability.level.price = null;

    this.update();
  }

  public setAbilityLevelByTier(tier: number, level: number): void {
    if (level < 1) {
      level = 1;
    }

    const ability = this._abilities.find(ability => ability.tier === tier && ability.abilityClass !== ABILITY_ATTACK);
    if (!ability) {
      throw new Error('No such tier!');
    }

    const abilityScheme = ABILITY_SCHEME[this._unit.levelInt - 1][ability.tier - 1];
    if (!abilityScheme) {
      return;
    }

    // Fallback to highest lvl
    level = Math.min(level, abilityScheme.lvl);

    ability.enabled = !!level;
    ability.level = {
      current: level,
      next: null,
      price: null,
    };
    ability.levelInt = level;
    ability.level.next = null;
    ability.level.price = null;

    this.update();
  }

  public getAbilityLevelByTier(tier: number): number {
    const ability = this._abilities.find(ability => ability.tier === tier && ability.abilityClass !== ABILITY_ATTACK);
    if (!ability) {
      throw new Error('No such tier!');
    }
    return ability.levelInt;
  }

  public getMaxAbilityLevel(abilityTier: number): number {
    const levelData = ABILITY_SCHEME[this._unit.levelInt - 1][abilityTier - 1];
    return levelData ? levelData.lvl : 0;
  }

  public upgradeAbility(abilityClass: string): boolean {
    if (!this.canUpgradeAbility(abilityClass)) {
      return false;
    }

    const ability = this._abilities.find(
      (entry) => entry.abilityClass === abilityClass
    );
    ability.level.current++;
    ability.levelInt++;

    const canUpgradeMore =
      ability.level.current < this.getMaxAbilityLevel(ability.tier);
    ability.level.next = canUpgradeMore ? ability.level.next + 1 : null;
    ability.level.price = canUpgradeMore
      ? this.getAbilityUpgradePrice(ability.tier, ability.level.next)
      : null;

    this.update();

    return true;
  }

  protected getAbilityUpgradePrice(tier: number, level: number) {
    return _.cloneDeep(ABILITY_LEVEL_UP_PRICES[tier - 1][level - 1]);
  }

  public canUpgradeAbility(abilityClass: string): boolean {
    const ability = this.getAbilityByClass(abilityClass);
    const abilityScheme =
      ABILITY_SCHEME[this._unit.levelInt - 1][ability.tier - 1];
    return (
      !!ability &&
      !!ability.level.next &&
      abilityScheme &&
      ability.level.current < abilityScheme.lvl
    );
  }

  public getAbilityByClass(abilityClass: string): BattleUnitAbility {
    const ability = this._abilities
      ? this._abilities.find((entry) => entry.abilityClass === abilityClass)
      : null;

    if (!ability) {
      throw new Error(
        `[Unit] Unit of class "${this._unit.class}" hasn't ability "${abilityClass}"`
      );
    }

    return ability;
  }

  public canUseAbility(abilityClass: string): boolean {
    if ([ABILITY_MOVE, ABILITY_ATTACK].includes(abilityClass)) {
      return true;
    }

    const unitMeta = game.battleManager.getUnitMeta(this._unit.template); // .find(unitData => unitData.template === this._unit.template);
    if (!unitMeta.abilityList.includes(abilityClass)) {
      return false;
    }

    const abilityEntry = this._abilities.find(
      (entry) => entry.abilityClass === abilityClass
    );

    if (
      abilityEntry &&
      abilityEntry.cooldown &&
      abilityEntry.cooldown.enabled
    ) {
      return false;
    }

    return true;
  }

  public strongestEnabledAbility(): string {
    const enabledAbilities = this._abilities
      .filter((entry) => {
        return entry.enabled && (!entry.cooldown || !entry.cooldown.enabled);
      })
      .map((entry) => entry.abilityClass);

    return enabledAbilities.length ? _.last(enabledAbilities) : ABILITY_ATTACK;
  }

  public getPower() {
    return _.sumBy(this._abilities, "value");
  }

  public reset() {
    this._abilities.forEach((ability) => {
      delete ability.cooldown;
    });
    this.update();
  }

  public maximize() {
    this._abilities.forEach((ability) => {
      const abilityScheme =
        ABILITY_SCHEME[this._unit.levelInt - 1][ability.tier - 1];
      if (abilityScheme) {
        this.setAbilityLevel(ability.abilityClass, abilityScheme.lvl);
      }
    });

    this.update();
  }
}
