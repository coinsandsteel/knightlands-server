import _ from "lodash"
import { ABILITY_ATTACK, ABILITY_MOVE, ABILITY_TYPE_ATTACK } from "../../../knightlands-shared/battle";
import {
  ABILITIES,
  ABILITY_LEVEL_UP_PRICES, 
  ABILITY_SCHEME, 
} from "../meta";
import {
  BattleUnitAbility,
  BattleUnitAbilityStat
} from "../types";
import { Unit } from "./Unit";
import game from "../../../game";

export default class UnitAbilities {
  protected _unit: Unit;
  protected _abilities: BattleUnitAbility[];
  protected _abilitiesStat: BattleUnitAbilityStat[];
  
  get abilities(): BattleUnitAbility[] {
    return this._abilities;
  }
  
  constructor(unit: Unit, abilities?: BattleUnitAbility[]) {
    this._unit = unit;
    this._abilitiesStat = [];

    if (abilities) {
      this._abilities = abilities;
    } else {
      // TODO update
      // TODO create abilityType
      // TODO add attack ability
      /*const abilities = this._abilityList.map((abilityClass, index) => {
        let tier = index + 1;
        return {
          abilityClass,
          abilityType: _.cloneDeep(ABILITY_TYPES[abilityClass]),
          tier,
          levelInt: !index ? 1 : 0,
          level: {
            current: !index ? 1 : 0, // Unlock only the first ability
            next: null,
            price: null
          },
          value: 0,
          combatValue: 0,
          enabled: !index ? true : false
        };  
      });*/
      this._abilities = [
        this.getAbilityByClass(ABILITY_ATTACK), 
        ...abilities
      ];
    }

    this._abilities.forEach(ability => {
      delete ability.cooldown;
    });
  }

  protected getAbilityValue(ability: string): number|null {
    let base = 0;
    
    if (ability === ABILITY_ATTACK) {
      return this._unit.damage;
    } else {
      const abilityData = this.getAbilityByClass(ability);
      const abilityLevel = abilityData.levelInt !== 0 ? abilityData.levelInt : 1;
      const abilityMeta = game.battleManager.getAbilityMeta(ability);
      // TODO update
      base = 0;
    }

    const abilityValue = base * this._unit.modifiers.power * this._unit.modifiers.abilities;
    //this.log(`Ability "${ability}" value: base=${base} * powerBonus=${this.modifiers.power} * attackBonus=${this.modifiers.attack} * abilitiesBonus=${this.modifiers.abilities} = ${abilityValue}`);

    return Math.round(abilityValue);
  }
  
  protected getAbilityCombatValue(ability: string): number|null {
    let base = 0 as number;
    if (ability === ABILITY_ATTACK) {
      base = this._unit.damage;
    } else {
      const abilityMeta = game.battleManager.getAbilityMeta(ability);
      const abilityStat = this.getAbilityStat(ability);
      if (abilityMeta.damageScheme === null) {
        const effects = abilityStat.effects;
        if (effects && effects.length && effects[0]) {
          const effect = effects[0];
          if (effect.probability) {
            base = effect.probability;
          } else if (effect.modifier) {
            base = effect.modifier;
          }
        } else {
          base = 0;
        }
      } else {
        base = null;
      }
    }
    return base;
  }
  
  public enableAbilityCooldown(abilityClass: string): void {
    this._abilities.forEach(abilityEntry => {
      if (
        abilityEntry.abilityClass === abilityClass
        &&
        abilityEntry.enabled
        && 
        (!abilityEntry.cooldown || !abilityEntry.cooldown.enabled)
      ) {
        const abilityScheme = ABILITY_SCHEME[this._unit.levelInt-1][abilityEntry.tier-1];
        abilityEntry.cooldown = {
          enabled: true,
          estimate: abilityScheme.cd
        }
        this.log(`Ability "${abilityClass}" cooldown has been set`, abilityEntry.cooldown);
      }
    });
  }

  public decreaseAbilitiesCooldownEstimate(): void {
    this._abilities.forEach(ability => {
      if (ability.cooldown && ability.cooldown.estimate > 0) {
        ability.cooldown.estimate--;

        if (ability.cooldown.estimate === 0) {
          ability.cooldown.enabled = false;
        }

        this.log(`Ability "${ability.abilityClass}" cooldown`, ability.cooldown);
      }
    });
  }

  public getAbilityRange(abilityClass: string, type: string): number {
    const abilityData = this.getAbilityByClass(abilityClass);
    const abilityMeta = ABILITIES[this._unit.class][abilityClass];

    let result;
    if (
      (type === "move" && abilityMeta.moveRange)
      ||
      (type === "attack" && abilityMeta.attackRange)
    ) {
      result = abilityMeta[type + "Range"];
      if (_.isArray(result)) {
        result = result[abilityData.levelInt-1];
      }
      if (_.isString(result)) {
        result = this._unit.getValueByFormula(result);
      }
    }

    return result || 0;
  }

  public getAbilityIgnoreObstacles(abilityClass: string): boolean {
    const abilityData = this.getAbilityByClass(abilityClass);
    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);

    let ignoreObstacles = abilityMeta.ignoreObstacles;
    return _.isArray(ignoreObstacles) ? 
      ignoreObstacles[abilityData.levelInt-1]
      :
      ignoreObstacles;
  }

  protected _getAbilityStat(abilityClass: string): BattleUnitAbilityStat {
    const abilityData = this.getAbilityByClass(abilityClass);
    const abilityMeta = game.battleManager.getAbilityMeta(abilityClass);
    const effects = abilityMeta.effects.length ?
      abilityMeta.effects[abilityData.levelInt === 0 ? 0 : abilityData.levelInt - 1]
      :
      [];

    // TODO update
    const abilityStat = {
      moveRange: this.getAbilityRange(abilityClass, "move"),
      attackRange: this.getAbilityRange(abilityClass, "attack"),
      ignoreObstacles: this.getAbilityIgnoreObstacles(abilityClass),
      effects
    } as BattleUnitAbilityStat;

    return abilityStat;
  }
  
  public getAbilityStat(abilityClass: string): BattleUnitAbilityStat {
    return this._abilitiesStat[abilityClass];
  }
  
  public update(): void {
    this._abilities.forEach(ability => {
      // Set ability stat
      this._abilitiesStat[ability.abilityClass] = this._getAbilityStat(ability.abilityClass);
      // TODO update
      // Update ability value
      const abilityValue = this.getAbilityValue(ability.abilityClass);
      const abilityCombatValue = this.getAbilityCombatValue(ability.abilityClass);
      ability.value = abilityValue;
      ability.combatValue = abilityCombatValue === null ? abilityValue : abilityCombatValue;
    });
  }

  // TODO update
  public serialize(): BattleUnitAbility[] {
    return this._abilities.map(ability => {
      return {
        abilityClass: ability.abilityClass,
        abilityType: ability.abilityType,
        tier: ability.tier,
        levelInt: ability.levelInt,
        value: ability.value,
        combatValue: ability.combatValue,
        enabled: ability.enabled,
        cooldown: {
          enabled: ability.cooldown ? ability.cooldown.enabled : false,
          estimate: ability.cooldown ? ability.cooldown.estimate : 0
        }
      } as BattleUnitAbility;
    });
  }

  public unlock(): void {
    this._abilities.forEach(ability => {
      const abilityScheme = ABILITY_SCHEME[this._unit.levelInt-1][ability.tier-1];
      if (abilityScheme) {
        // Unlock ability
        if (ability.level.current === 0) {
          ability.enabled = true;
          ability.level.current = 1;
          ability.levelInt = 1;
          this.log(`Ability enabled`, ability);
        }
        
        const canUpgradeMore = ability.level.current < abilityScheme.lvl;
        ability.level.next = canUpgradeMore ? ability.level.current + 1 : null;
        ability.level.price = canUpgradeMore ? this.getAbilityUpgradePrice(ability.tier, ability.level.next) : null;
        if (canUpgradeMore) {
          this.log(`Ability allowed to upgrade to ${abilityScheme.lvl} lvl`, ability);
        }
      }
    });
  }

  public setAbilityLevel(abilityClass: string, level: number) {
    this._abilities.forEach(ability => {
      if (ability.abilityClass !== abilityClass) {
        return;
      }
      
      ability.enabled = true;
      ability.level = {
        current: level,
        next: null,
        price: null
      };
      ability.levelInt = level;
      ability.level.next = null;
      ability.level.price = null;

      // Set ability stat
      this._abilitiesStat[ability.abilityClass] = this._getAbilityStat(ability.abilityClass);
      
      // Update ability value
      const abilityValue = this.getAbilityValue(ability.abilityClass);
      const abilityCombatValue = this.getAbilityCombatValue(ability.abilityClass);
      
      ability.value = abilityValue;
      ability.combatValue = abilityCombatValue === null ? abilityValue : abilityCombatValue;
    });

    this.update();
  }

  public upgradeAbility(abilityClass: string): boolean {
    if (!this.canUpgradeAbility(abilityClass)) {
      return false;
    }

    const ability = this._abilities.find(entry => entry.abilityClass === abilityClass);
    const abilityScheme = ABILITY_SCHEME[this._unit.levelInt-1][ability.tier-1];
    ability.enabled = true;
    ability.level.current++;
    ability.levelInt++;

    const canUpgradeMore = ability.level.current < abilityScheme.lvl;
    ability.level.next = canUpgradeMore ? ability.level.next + 1 : null;
    ability.level.price = canUpgradeMore ? this.getAbilityUpgradePrice(ability.tier, ability.level.next) : null;

    this.update();

    return true;
  }

  protected getAbilityUpgradePrice(tier: number, level: number){
    return _.cloneDeep(ABILITY_LEVEL_UP_PRICES[tier-1][level-1]);
  }

  public canUpgradeAbility(abilityClass: string): boolean {
    const ability = this.getAbilityByClass(abilityClass);
    const abilityScheme = ABILITY_SCHEME[this._unit.levelInt-1][ability.tier-1];
    return (
      !!ability
      &&
      !!ability.level.next
      &&
      abilityScheme
      &&
      ability.level.current < abilityScheme.lvl
    );
  }

  public getAbilityByClass(abilityClass: string): BattleUnitAbility {
    // TODO update
    if (abilityClass === ABILITY_ATTACK) {
      return {
        abilityClass,
        abilityType: ABILITY_TYPE_ATTACK,
        tier: 1,
        levelInt: 1,
        level: {
          current: 1,
          next: null,
          price: null
        },  
        value: this._unit.damage,
        combatValue: this._unit.damage,
        enabled: true
      }
    }

    const ability = this._abilities ?
      this._abilities.find(entry => entry.abilityClass === abilityClass)
      :
      null;

    if (!ability) {
      throw new Error(`[Unit] Unit of class "${this._unit.class}" haven't ability "${abilityClass}"`);
    }
    
    return ability;
  }

  public canUseAbility(ability: string): boolean {
    if ([ABILITY_MOVE, ABILITY_ATTACK].includes(ability)) {
      return true;
    }
    
    // TODO update
    const unitMeta = game.battleManager.meta.units.find(unitData => unitData.template === this._unit.template);
    if (!unitMeta.abilityList.includes(ability)) {
      //console.log('[canUseAbility] Not included');
      return false;
    }
    
    const abilityEntry = this._abilities.find(entry => entry.abilityClass === ability);
    if (abilityEntry && abilityEntry.cooldown && abilityEntry.cooldown.enabled) {
      //console.log('[canUseAbility] Cooldown enabled');
      return false;
    }

    return true;
  }

  public strongestEnabledAbility(): string {
    const enabledAbilities = this._abilities.filter(entry => {
      return entry.enabled && (!entry.cooldown || !entry.cooldown.enabled)
    }).map(entry => entry.abilityClass);
    
    return enabledAbilities.length ? _.last(enabledAbilities) : ABILITY_ATTACK;
  }

  public getPower() {
    return  _.sumBy(this._abilities, "value");
  }

  public reset() {
    this._abilitiesStat = [];
    this._abilities.forEach(ability => {
      delete ability.cooldown;
    });
  }

  public maximize() {
    this._abilities.forEach(ability => {
      const abilityScheme = ABILITY_SCHEME[this._unit.levelInt-1][ability.tier-1];
      if (abilityScheme) {
        ability.enabled = true;
        ability.level = {
          current: abilityScheme.lvl,
          next: null,
          price: null
        };
        ability.levelInt = abilityScheme.lvl;
        ability.level.next = null;
        ability.level.price = null;
      }
    });
  }

  protected log(message: string, payload?: any) {
    //console.log(`[Unit id=${this._unitId} fighterId=${this._fighterId}] ${message}`, payload);
  }
}
