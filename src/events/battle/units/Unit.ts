import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { threadId } from "worker_threads";
import { ABILITY_ATTACK, ABILITY_MOVE, ABILITY_TYPES } from "../../../knightlands-shared/battle";
import {
  ABILITIES,
  ABILITY_LEVEL_UP_PRICES, 
  ABILITY_SCHEME, 
  AVG_DMG, 
  AVG_HP, 
  CHARACTERISTICS,
  SETTINGS,
  UNITS,
  UNIT_LEVEL_UP_PRICES
} from "../meta";
import {
  BattleBuff, BattleLevelScheme,
  BattleUnit, BattleUnitAbility,
  BattleUnitCharacteristics
} from "../types";

export class Unit {
  protected _template: number;
  protected _isEnemy: boolean;
  protected _isDead: boolean;
  protected _fighterId: string;
  protected _unitId: string;
  protected _unitTribe: string; // 15
  protected _unitClass: string; // 5
  protected _tier: number; // 3, modify via merger (3 => 1)
  protected _level: BattleLevelScheme; // exp > max limit > pay coins > lvl up > characteristics auto-upgrade
  protected _levelInt: number;
  protected _power: number;
  protected _expirience: {
    value: number;
    currentLevelExp: number;
    nextLevelExp: number;
  };
  protected _characteristics: BattleUnitCharacteristics;
  protected _abilityList: string[];
  protected _abilities: BattleUnitAbility[];
  protected _quantity: number;
  
  // Combat
  protected _hp: number;
  protected _index: number;
  protected _buffs: BattleBuff[];

  protected _moveCells: number[];
  protected _attackCells: number[];

  get index(): number {
    return this._index;
  }

  get tier(): number {
    return this._tier;
  }

  get tribe(): string {
    return this._unitTribe;
  }

  get class(): string {
    return this._unitClass;
  }

  get fighterId(): string {
    return this._fighterId;
  }

  get isEnemy(): boolean {
    return this._isEnemy;
  }

  get isDead(): boolean {
    return this._isDead;
  }

  get unitId(): string {
    return this._unitId;
  }

  get template(): number {
    return this._template;
  }

  get quantity(): number {
    return this._quantity;
  }

  get level(): BattleLevelScheme {
    return this._level;
  }

  get power(): number {
    return this._power;
  }

  get hp(): number {
    return this._hp;
  }

  get maxHp(): number {
    return this._characteristics.hp;
  }

  get speed(): number {
    return this._characteristics.speed;
  }

  get initiative(): number {
    return this._characteristics.initiative;
  }

  get defence(): number {
    return this._characteristics.defence;
  }

  get damage(): number {
    return this._characteristics.damage;
  }

  get moveCells(): number[] {
    return this._moveCells;
  }

  get buffs(): BattleBuff[] {
    return this._buffs;
  }

  constructor(blueprint: BattleUnit) {
    this._template = blueprint.template;
    this._unitId = blueprint.unitId || uuidv4().split('-').pop();
    this._unitTribe = blueprint.unitTribe;
    this._unitClass = blueprint.unitClass;
    
    if ("fighterId" in blueprint) {
      this._fighterId = blueprint.fighterId;
    }
    
    if ("isEnemy" in blueprint) {
      this._isEnemy = blueprint.isEnemy;
    }
    
    if ("isDead" in blueprint) {
      this._isDead = blueprint.isDead;
    }
    
    if ("tier" in blueprint) {
      this._tier = blueprint.tier;
    } else {
      throw Error("Unit's tier was not set");
    }
    
    if ("level" in blueprint) {
      this._level = blueprint.level;
    } else {
      this._level = {
        current: 1,
        next: null,
        price: null
      } as BattleLevelScheme;
    }

    if ("levelInt" in blueprint) {
      this._levelInt = blueprint.levelInt;
    } else if ("level" in blueprint) {
      this._levelInt = blueprint.level.current;
    } else {
      this._levelInt = this._level.current;
    }
    
    if ("expirience" in blueprint) {
      this._expirience = blueprint.expirience;
    } else {
      this._expirience = {
        value: 0,
        currentLevelExp: 0,
        nextLevelExp: this.getExpForLevel(2)
      };
    }

    if ("characteristics" in blueprint) {
      this._characteristics = blueprint.characteristics;
    } else {
      this._characteristics = Unit.getCharacteristics(this._unitClass, this._levelInt);
    }

    if ("abilityList" in blueprint) {
      this._abilityList = blueprint.abilityList;
    }

    if ("abilities" in blueprint) {
      this._abilities = blueprint.abilities;
    } else if (this._abilityList.length) {
      const abilities = this._abilityList.map((abilityClass, index) => {
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
          value: this.getAbilityValue(abilityClass, 1),
          enabled: !index ? true : false
        };  
      });  

      this._abilities = abilities;
    } else {
      throw Error("Abilities was not set");
    }

    if ("quantity" in blueprint) {
      this._quantity = blueprint.quantity;
    } else {
      this._quantity = 1;
    }

    if ("index" in blueprint) {
      this._index = blueprint.index;
    } else {
      this._index = null;
    }

    if ("hp" in blueprint) {
      this._hp = blueprint.hp;
    } else {
      this._hp = this._characteristics.hp;
    }

    if ("buffs" in blueprint) {
      this._buffs = blueprint.buffs;
    } else {
      this._buffs = [];
    }

    this.setPower();
  }

  public regenerateFighterId(): void {
    this._fighterId = uuidv4().split('-').pop();
  }

  protected getAbilityValue(ability: string, level?: number): number|null {
    const abilities =  _.cloneDeep(ABILITIES);
    const abilityData = (
      abilities[this._unitClass] ? abilities[this._unitClass][ability] : null
    );

    /*console.log("getAbilityValue", {
      byUnitClass: (abilities[this._unitClass] ? abilities[this._unitClass][ability] : null),
      byAbility: ABILITIES.other[ability] || null
    });*/
    
    if (!abilityData) {
      throw Error(`Unit ${this._unitClass} has no "${ability}" ability`);
    }

    // TODO use ability tier!!! sic...
    const abilityTierData = abilityData[this._tier - 1];
    if (!abilityTierData) {
      return null;
    }

    const abilityValue = abilityTierData[level - 1];
    if (!abilityValue) {
      return null;
    }

    return abilityValue;
  }

  protected setPower() {
    const statsSum = 
      this._characteristics.hp + 
      this._characteristics.damage + 
      this._characteristics.defence + 
      this._characteristics.initiative + 
      this._characteristics.speed;

    const abilitySum = _.sumBy(this._abilities, "value");
    this._power = (statsSum + abilitySum) * 2;
  }
    
  public serialize(): BattleUnit {
    const unit = {
      template: this._template,
      unitId: this._unitId,
      unitTribe: this._unitTribe,
      unitClass: this._unitClass,
      tier: this._tier,
      level: this._level,
      power: this._power,
      expirience: this._expirience,
      characteristics: this._characteristics,
      abilities: this._abilities,
      quantity: this._quantity
    } as BattleUnit;

    return _.cloneDeep(unit);
  }

  public serializeForSquad(): BattleUnit {
    const abilities = this._abilities.map(ability => {
      return {
        abilityClass: ability.abilityClass,
        abilityType: ability.abilityType,
        tier: ability.tier,
        value: ability.value,
        enabled: ability.enabled,
        cooldown: {
          enabled: false,
          estimate: 0
        }
      } as BattleUnitAbility;
    });

    const squadUnit = {
      template: this._template,
      fighterId: this._fighterId,
      isEnemy: this._isEnemy,
      isDead: this._isDead || false,
      unitId: this._unitId,
      unitTribe: this._unitTribe,
      unitClass: this._unitClass,
      tier: this._tier,
      levelInt: this._level.current,
      power: this._power,
      index: this._index,
      hp: this._hp,
      abilities,
      buffs: this._buffs
    } as BattleUnit;

    return _.cloneDeep(squadUnit);
  }

  public updateQuantity(value: number): void {
    this._quantity += value;
  }

  public addExpirience(value): void {
    if (this._tier === 1 && this._levelInt >= SETTINGS.maxUnitTierLevel[1]) {
      return;
    }

    if (this._tier === 2 && this._levelInt >= SETTINGS.maxUnitTierLevel[2]) {
      return;
    }

    this._expirience.value += value;
 
    const lastLevelExpEnd = this.getExpForLevel(SETTINGS.maxUnitTierLevel[3]);
    if (this._levelInt >= SETTINGS.maxUnitTierLevel[3]-1 && this._expirience.value > lastLevelExpEnd) {
      this._expirience.value = lastLevelExpEnd;
      return;
    }

    let priceTable = _.cloneDeep(UNIT_LEVEL_UP_PRICES);
    
    let currentExp = this._expirience.value;
    let currentLevel = this._level.current;
    let newLevel = currentLevel + 1;

    let currentLevelExpStart = this.getExpForLevel(currentLevel);
    let currentLevelExpEnd = this.getExpForLevel(newLevel);

    if (currentExp >= currentLevelExpEnd) {
      this._level.next = currentLevel + 1;
      this._level.price = priceTable[this._level.next - 1];
    } else {
      this._level.next = null;
      this._level.price = null;
    }

    let fullGap = currentLevelExpEnd - currentLevelExpStart;
    let currentGap = currentExp - currentLevelExpStart;

    this._expirience.currentLevelExp = currentGap;
    this._expirience.nextLevelExp = fullGap;

    //console.log("[addExpirience] Expirience result", this._expirience);
  }

  public upgradeLevel(): boolean {
    if (!this.canUpgradeLevel()) {
      return false;
    }

    this._levelInt = this._level.next;
    this._level.current = this._level.next;
    this._level.next = null;
    this._level.price = null;

    this.addExpirience(0);
    this.setCharacteristics();
    this.setPower();
    this.unlockAbilities();

    return true;
  }

  public static getCharacteristics(unitClass: string, level: number): BattleUnitCharacteristics {
    const characteristicsMeta = _.cloneDeep(CHARACTERISTICS);
    const meta = characteristicsMeta[unitClass];

    let percentage = (level - 1) * 0.05;
    let boundary = (
      level <= SETTINGS.maxUnitTierLevel[1] ? 
        0
        :
        (level <= SETTINGS.maxUnitTierLevel[2] ? 1 : 2)
    );
    let base = _.cloneDeep(meta.base[boundary]);

    // hp
    let hpBase = AVG_HP * meta.multipliers.hp;
    let hp = hpBase * (1 + percentage);

    // damage
    let damageBase = AVG_DMG * meta.multipliers.damage;
    let damage = damageBase * (1 + percentage);

    // defence
    let defenceBase = 0;
    if (base.defence === "lvl-6" && level >= SETTINGS.maxUnitTierLevel[1] + 1) {
      let minus6LvlStats = Unit.getCharacteristics(unitClass, (boundary * SETTINGS.maxUnitTierLevel[1] + 1) - (boundary === 1 ? 6 : 7));
      defenceBase = minus6LvlStats.defence;
    } else if (_.isNumber(base.defence)) {
      defenceBase = base.defence;
    } else {
      throw Error("Invalid defence scheme was used");
    }

    let innerTierLvl = level - 1 - SETTINGS.maxUnitTierLevel[1] * boundary;
    let defence = defenceBase + base.defIncrement * innerTierLvl;

    //console.log({ level, defenceBase, innerTierLvl });

    // speed
    let speed = base.speed;

    // speed
    let initiative = base.initiative;

    return {
      hp: Math.round(hp),
      damage: Math.round(damage),
      defence: Math.round(defence),
      speed,
      initiative
    };

    /*return {
      hp,
      damage,
      defence,
      speed,
      initiative
    };*/
  }

  protected setCharacteristics(): void {
    this._characteristics = Unit.getCharacteristics(this._unitClass, this._levelInt);
  }

  protected unlockAbilities(): void {
    this._abilities.forEach(ability => {
      const abilityScheme = ABILITY_SCHEME[this._levelInt-1][ability.tier-1];
      if (abilityScheme) {
        // Unlock ability
        if (ability.level.current === 0) {
          ability.enabled = true;
          ability.level.current = 1;
          ability.value = this.getAbilityValue(ability.abilityClass, ability.level.current);
          console.log(`[Unit] Ability is enabled`, ability);
        }
        
        const canUpgradeMore = ability.level.current < abilityScheme.lvl;
        ability.level.next = canUpgradeMore ? ability.level.current + 1 : null;
        ability.level.price = canUpgradeMore ? this.getAbilityUpgradePrice(ability.tier, ability.level.next) : null;
        if (canUpgradeMore) {
          console.log(`[Unit] Ability is allowed to upgrade to ${abilityScheme.lvl} lvl`, ability);
        }
      }
    });
  }

  public maximize() {
    this._levelInt = SETTINGS.maxUnitTierLevel[3];
    this._level.current = SETTINGS.maxUnitTierLevel[3];
    this._level.next = null;
    this._expirience.value = SETTINGS.maxExp;
    this._expirience.currentLevelExp = 0;
    this._expirience.nextLevelExp = 0;

    this.unlockAbilities();
  }

  public canUpgradeLevel(): boolean {
    return !!this._level.next;
  }

  public upgradeAbility(abilityClass: string): boolean {
    if (!this.canUpgradeAbility(abilityClass)) {
      return false;
    }

    const ability = this._abilities.find(entry => entry.abilityClass === abilityClass);
    const abilityScheme = ABILITY_SCHEME[this._levelInt-1][ability.tier-1];
    ability.enabled = true;
    ability.level.current++;
    ability.value = this.getAbilityValue(abilityClass, ability.level.current);

    const canUpgradeMore = ability.level.current < abilityScheme.lvl;
    ability.level.next = canUpgradeMore ? ability.level.next + 1 : null;
    ability.level.price = canUpgradeMore ? this.getAbilityUpgradePrice(ability.tier, ability.level.next) : null;

    this.setPower();

    return true;
  }

  protected getAbilityUpgradePrice(tier: number, level: number){
    return _.cloneDeep(ABILITY_LEVEL_UP_PRICES[tier-1][level-1]);
  }

  public canUpgradeAbility(abilityClass: string): boolean {
    const ability = this.getAbilityByClass(abilityClass);
    const abilityScheme = ABILITY_SCHEME[this._levelInt-1][ability.tier-1];
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

  public getAbilityByClass(abilityClass: string): BattleUnitAbility|null {
    const ability = this._abilities.find(entry => entry.abilityClass === abilityClass);
    return ability || null;
  }

  public setIndex(index: number): void {
    if (index < 0 || index > 34) {
      throw Error("Unit index overflow");
    }
    this._index = index;
    this._moveCells = [];
  }

  public canUseAbility(ability: string): boolean {
    if ([ABILITY_MOVE, ABILITY_ATTACK].includes(ability)) {
      return true;
    }

    const unitMeta = UNITS.find(unitData => unitData.template === this._template);
    if (!unitMeta.abilityList.includes(ability)) {
      return false;
    }
    
    const abilityEntry = this._abilities.find(entry => entry.abilityClass === ability);
    if (abilityEntry && abilityEntry.cooldown && abilityEntry.cooldown.enabled) {
      return false;
    }

    return true;
  }

  public canMoveToCell(index: number): boolean {
    if (
      !this._moveCells
      ||
      !this._moveCells.length
      ||
      !this._moveCells.includes(index)
    ) {
      return false;
    }

    return true;
  }

  public enableAbilityCooldown(ability: string): void {
    const abilityEntry = this.getAbilityByClass(ability);
    if (
      abilityEntry 
      && 
      abilityEntry.enabled
      && 
      (!abilityEntry.cooldown || !abilityEntry.cooldown.enabled)
    ) {
      const abilityScheme = ABILITY_SCHEME[this._levelInt-1][abilityEntry.tier-1];
      abilityEntry.cooldown = {
        enabled: true,
        estimate: abilityScheme.cd
      }
    }
  }

  public decreaseAbilitiesCooldownEstimate(): void {
    this._abilities.forEach(ability => {
      if (ability.cooldown && ability.cooldown.estimate > 0) {
        const oldCooldown = _.clone(ability.cooldown.estimate);
        ability.cooldown.estimate--;
        const newCooldown = _.clone(ability.cooldown.estimate);

        if (ability.cooldown.estimate === 0) {
          ability.cooldown.enabled = false;
        }

        console.log("Ability cooldown", {
          old: oldCooldown,
          new: newCooldown,
          cooldownEnabled: ability.cooldown.enabled
        });
      }
    });
  }

  public buff(paylod: BattleBuff|BattleBuff[]): void {
    // TODO squad_bonus
    // TODO buff / de-buff
    // TODO terrain
    if (Array.isArray(paylod)) {
      paylod.forEach(buff => this.applyBuff(buff));
    } else {
      this.applyBuff(paylod);
    }

    /*this._buffs.push(paylod);
    paylod.estimate = 3;
    console.log(`[Unit #${this._fighterId}] Buff added`, paylod);
    return paylod;*/
  };
  
  protected applyBuff(buff: BattleBuff) {
    this._buffs.push(buff);

    // "squad_bonus", "buff", "de-buff", "terrain"
    if (buff.source === "squad_bonus") {
      switch (buff.type) {
        case "attack": {
          break;
        }
        case "swamp_speed":
        case "defence_stack": {
          break;
        }
      }
    } else if (buff.source === "buff") {

    } else if (buff.source === "de-buff") {

    } else if (buff.source === "terrain") {

    }
  }

  public getBuff(params: { source?: string, type?: string }): BattleBuff {
    const choosedBuffs = _.sortBy(_.filter(this._buffs, params), "modifier");
    console.log("[Unit] getBuff", { params, result: choosedBuffs });
    return _.tail(choosedBuffs);
  }

  public removeBuffs(source: string, type?: string): void {
    console.log(`[Unit #${this._fighterId}] Remove buffs`, { source, type });
    this._buffs = this._buffs.filter(buff => !(
      buff.source === source && (!type || buff.type === type)
    ));
  };

  public decreaseBuffsEstimate(): void {
    this._buffs.forEach(buff => {
      const oldEstimate = _.clone(buff.estimate);
      buff.estimate--;
      const newEstimate = _.clone(buff.estimate);

      console.log(`[Unit #${this._fighterId}] Decreased buff estimate`, {
        old: oldEstimate,
        new: newEstimate,
        buffActive: buff.estimate > 0
      });
    });

    this._buffs = this._buffs.filter(buff => buff.estimate > 0);
  };

  public modifyHp(value: number): void {
    if (this._isDead) {
      return;
    }
    this._hp += value;
    if (this._hp <= 0) {
      this._isDead = true;
    }
  };

  public randomAbility(): string {
    const enabledAbilities = this._abilities.filter(entry => {
      return entry.enabled && (!entry.cooldown || !entry.cooldown.enabled)
    }).map(entry => entry.abilityClass);
    
    return enabledAbilities.length ? _.sample(enabledAbilities) : ABILITY_ATTACK;
  }

  public strongestEnabledAbility(): string {
    const enabledAbilities = this._abilities.filter(entry => {
      return entry.enabled && (!entry.cooldown || !entry.cooldown.enabled)
    }).map(entry => entry.abilityClass);
    
    return enabledAbilities.length ? _.last(enabledAbilities) : ABILITY_ATTACK;
  }

  public resurrect(): void {
    this._isDead = false;
  }

  public getExpForLevel(level: number): number {
    let i = 0;
    let exp = 0;
    while (i < level) {
      exp += i * 100;
      i++;
    }
    return exp;
  }
}