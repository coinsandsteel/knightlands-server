import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { ABILITY_ATTACK, ABILITY_MOVE, ABILITY_TYPES, ABILITY_TYPE_ATTACK, ABILITY_TYPE_DE_BUFF, TERRAIN_ICE, TERRAIN_HILL, TERRAIN_WOODS, TERRAIN_SWAMP, TERRAIN_LAVA } from "../../../knightlands-shared/battle";
import { BattleEvents } from "../BattleEvents";
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
  BattleUnitAbilityStat,
  BattleUnitCharacteristics
} from "../types";

export class Unit {
  protected _events: BattleEvents;

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
  protected _abilitiesStat: BattleUnitAbilityStat[];
  protected _quantity: number;
  
  // Combat
  protected _info: any;
  protected _ratingIndex: number;
  protected _isStunned: boolean;
  protected _hp: number;
  protected _index: number;
  protected _buffs: BattleBuff[] = [
    //{ source: "squad", mode: "burst", type: "power", modifier: 1.3, probability: 0.07 },
    //{ source: "squad", mode: "constant", type: "power", terrain: "hill", scheme: "hill-1" },
    //{ source: "squad", mode: "stack", type: "power", trigger: "damage", delta: 2.5, percents: true, max: 15 },
    //{ source: "squad", mode: "stack", type: "attack", trigger: "damage", delta: 2.5, percents: true, max: 15 },
    //{ source: "squad", mode: "constant", type: "attack", modifier: 1.5 },
    //{ source: "squad", mode: "constant", type: "abilities", modifier: 1.05 },
    //{ source: "squad", mode: "stack", type: "defence", trigger: "damage", delta: 1, max: 4 },
    //{ source: "squad", mode: "constant", type: "defence", terrain: "woods", scheme: "woods-1" },
    //{ source: "squad", mode: "constant", type: "defence", terrain: "ice", scheme: "ice-1" },
    //{ source: "squad", mode: "constant", type: "defence", modifier: 1.05 },
    //{ source: "squad", mode: "stack", type: "speed", trigger: "debuff", delta: 1 },
    //{ source: "squad", mode: "constant", type: "speed", terrain: "swamp", scheme: "swamp-1" },
    //{ source: "squad", mode: "constant", type: "speed", terrain: "swamp", scheme: "swamp-1" },
    //{ source: "squad", mode: "constant", type: "hp", modifier: 1.05 },
    //{ source: "squad", mode: "constant", type: "hp", modifier: 1.05 },
    //{ source: "squad", mode: "constant", type: "lava_damage", terrain: "lava", scheme: "lava-1" },
    //{ source: "squad", mode: "burst", type: "counter_attack", probability: 0.07 },

    //{ source: "terrain", mode: "constant", type: "defence", terrain: "woods", scheme: "woods-1" },
    //{ source: "terrain", mode: "constant", type: "speed", terrain: "swamp", scheme: "swamp-1", estimate: 1 },
    //{ source: "terrain", mode: "constant", type: "damage", terrain: "ice", scheme: "ice-1" },
    //{ source: "terrain", mode: "constant", type: "damage", terrain: "hill", scheme: "hill-1" },
    
    //{ source: "buff", mode: "constant", type: "defence", modifier: 1.75, estimate: 1 },
    //{ source: "buff", mode: "constant", type: "defence", modifier: 1.15 },
    //{ source: "buff", mode: "constant", type: "initiative", modifier: 0.8 },
    //{ source: "self-buff", mode: "constant", type: "power", modifier: 1.15 },
    //{ source: "self-buff", mode: "constant", type: "speed", modifier: 1.2 },
    //{ source: "de-buff", mode: "constant", type: "speed", modifier: 0.8 },
    //{ source: "de-buff", mode: "constant", type: "stun", probability: 1, estimate: 1 }, 
    //{ source: "de-buff", mode: "constant", type: "stun", probability: 0.25, estimate: 2 },
    //{ source: "de-buff", mode: "constant", type: "agro", probability: 1, estimate: 1 }, 
    //{ source: "de-buff", mode: "constant", type: "agro", probability: 0.10, estimate: 2 },
  ];

  protected _terrainModifiers = {
    [TERRAIN_ICE]: "ice-0",
    [TERRAIN_HILL]: "hill-0",
    [TERRAIN_WOODS]: "woods-0",
    [TERRAIN_SWAMP]: "swamp-0",
    [TERRAIN_LAVA]: "lava-0"
  }; 

  protected modifiers: {
    speed: number;
    initiative: number;
    defence: number;
    power: number;
    attack: number;
    abilities: number;
  };

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

  get ratingIndex(): number {
    return this._ratingIndex;
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
    const bonusDelta = this.getBonusDelta("speed");
    this._info["speed"] = {
      base: this._characteristics.speed,
      modifier: this.modifiers.speed,
      delta: bonusDelta
    }
    return Math.round(this._characteristics.speed * this.modifiers.speed) + bonusDelta;
  }
  
  get initiative(): number {
    const bonusDelta = this.getBonusDelta("initiative");
    this._info["initiative"] = {
      base: this._characteristics.initiative,
      modifier: this.modifiers.initiative,
      delta: bonusDelta
    }
    return Math.round(this._characteristics.initiative * this.modifiers.initiative) + bonusDelta;
  }
  
  get defence(): number {
    const bonusDelta = this.getBonusDelta("defence");
    this._info["defence"] = {
      base: this._characteristics.defence,
      modifier: this.modifiers.defence,
      delta: bonusDelta
    }
    return Math.round(this._characteristics.defence * this.modifiers.defence) + bonusDelta;
  }
  
  get damage(): number {
    const bonusDelta = this.getBonusDelta("damage");
    this._info["damage"] = {
      base: this._characteristics.damage,
      power: this.modifiers.power,
      attack: this.modifiers.attack,
      delta: bonusDelta
    }
    return Math.round(this._characteristics.damage * this.modifiers.power * this.modifiers.attack) + bonusDelta;
  }
  
  get abilities(): BattleUnitAbility[] {
    return this._abilities;
  }

  get abilitiesStat(): BattleUnitAbilityStat[] {
    return this._abilitiesStat;
  }
  
  get buffs(): BattleBuff[] {
    return this._buffs;
  }

  get isStunned(): boolean {
    return this._isStunned;
  }

  get hasAgro(): boolean {
    return !!this.getBuffs({ type: "agro" }).length;
  }

  get agroTargets(): string[] {
    return this.getBuffs({ type: "agro" }).map(buff => buff.targetFighterId);
  }

  get wantToCounterAttack(): boolean {
    return !this.isStunned && this.getBuffs({ type: "counter_attack" }).some(buff => Math.random() <= buff.probability);
  }

  get variables(): any {
    return {
      modifiers: this.modifiers,
      abilities: _.fromPairs(this._abilities.map(ability => [ability.abilityClass, { value: ability.value, combatValue: ability.combatValue }])),
      abilitiesStat: this._abilitiesStat,
      buffs: this._buffs,
      ratingIndex: this._ratingIndex,
      isStunned: this._isStunned,
      isDead: this._isDead,
      index: this._index,
      hp: this._hp
    };
  }

  constructor(blueprint: BattleUnit, events: BattleEvents) {
    this._info = {};
    this._events = events;

    this.modifiers = {
      speed: -1,
      initiative: -1,
      defence: -1,
      power: -1,
      attack: -1,
      abilities: -1
    };
      
    this._abilitiesStat = [];
      
    this._template = blueprint.template;
    this._unitId = blueprint.unitId || uuidv4().split('-').pop();
    this._unitTribe = blueprint.unitTribe;
    this._unitClass = blueprint.unitClass;
    
    if ("ratingIndex" in blueprint) {
      this._ratingIndex = blueprint.ratingIndex;
    }
    
    if ("isStunned" in blueprint) {
      this._isStunned = blueprint.isStunned;
    } else {
      this._isStunned = false;
    }
    
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
          value: 0,
          combatValue: 0,
          enabled: !index ? true : false
        };  
      });
      this._abilities = [
        this.getAbilityByClass(ABILITY_ATTACK), 
        ...abilities
      ];
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
      this._hp = this.maxHp;
    }

    if ("buffs" in blueprint) {
      this._buffs = blueprint.buffs;
    } else {
      this._buffs = [];
    }
    
    this.log(`Init (need commit)`);
    this.commit();
  }

  public reset(): void {
    this.log(`Reset started (need commit)`);
    
    this.modifiers = {
      speed: -1,
      initiative: -1,
      defence: -1,
      power: -1,
      attack: -1,
      abilities: -1
    };
    this._abilitiesStat = [];

    this._ratingIndex = null;
    this._isStunned = false;
    this._isDead = false;
    this._index = null;
    this._hp = this.maxHp;
    
    this._abilities.forEach(ability => {
      delete ability.cooldown;
    });
    this._buffs = [];

    this.commit(true);

    this.log(`Reset finished`, this.variables);
  }
  
  public regenerateFighterId(): void {
    this._fighterId = uuidv4().split('-').pop();
  }

  protected getAbilityValue(ability: string): number|null {
    let base = 0;
    
    if (ability === ABILITY_ATTACK) {
      return this.damage;
    } else {
      const abilityData = this.getAbilityByClass(ability);
      const abilityLevel = abilityData.levelInt !== 0 ? abilityData.levelInt : 1;
      if (!ABILITIES[this._unitClass][ability]) {
        throw Error(`Unit ${this._unitClass} hasn't "${ability}" ability`);
      }
      if (!ABILITIES[this._unitClass][ability].damage[this._tier - 1]) {
        return 0;
      }
      let damageValues = _.flattenDeep(
        ABILITIES[this._unitClass][ability].damage
          .filter(n => n)
      );
      base = damageValues[abilityLevel-1];
    }

    const abilityValue = base * this.modifiers.power * this.modifiers.abilities;
    //this.log(`Ability "${ability}" value: base=${base} * powerBonus=${this.modifiers.power} * attackBonus=${this.modifiers.attack} * abilitiesBonus=${this.modifiers.abilities} = ${abilityValue}`);

    return Math.round(abilityValue);
  }
  
  protected getAbilityCombatValue(ability: string): number|null {
    let base = 0 as number;
    if (ability === ABILITY_ATTACK) {
      base = this.damage;
    } else {
      const abilityMeta = ABILITIES[this.class][ability];
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
        const abilityScheme = ABILITY_SCHEME[this._levelInt-1][abilityEntry.tier-1];
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

  public attackCallback() {
    // { source: "squad", mode: "stack", type: "power", trigger: "damage", delta: 2.5, percents: true, max: 15 },
    // { source: "squad", mode: "stack", type: "attack", trigger: "damage", delta: 2.5, percents: true, max: 15 },
    // { source: "squad", mode: "stack", type: "defence", trigger: "damage", delta: 1, max: 4 },
    const buffs = this.getBuffs({ trigger: "damage" });
    if (buffs.length) {
      buffs.forEach(buff => {
        // Stack
        if (
          buff.mode === "stack"
          && 
          typeof buff.stackValue !== 'undefined'
          &&
          buff.stackValue < buff.max
        ) {
          buff.stackValue += buff.delta;
          this.log(`${buff.type} stacked`, buff);
        }
      });
    }
  }

  public getBuffs(params: { source?: string, type?: string, trigger?: string }): BattleBuff[] {
    return _.filter(this._buffs, params);
  }

  public getBuffModifier(params: { source?: string, type?: string }): number {
    const buffs = this.getBuffs(params);
    if (!buffs.length) {
      return 1;
    }

    let modifier = 1;
    buffs.forEach(buff => {
      // Constant
      if (buff.mode === "constant" && !buff.trigger) {
        //{ source: "self-buff", mode: "constant", type: "power", modifier: 1.15 }
        //{ source: "squad", mode: "constant", type: "power", terrain: "hill", scheme: "hill-1" }
        modifier = modifier * (
          buff.terrain ? 
            this.getTerrainModifier(buff.terrain)
            :
            buff.modifier
        );
      
      // Burst
      } else if (buff.mode === "burst") {
        //{ source: "squad", mode: "burst", type: "power", modifier: 1.3, probability: 0.07 },
        modifier = modifier * (Math.random() <= buff.probability ? buff.modifier : 1);
      
      // Stacked
      } else if (buff.mode === "stack" && buff.multiply) {
        modifier = modifier * (1 + buff.stackValue);
      }
    });

    return modifier;
  }

  public getBonusDelta(type: string): number {
    const buffs = this.getBuffs({ type });
    if (!buffs.length) {
      return 0;
    }

    let modifier = 0;
    buffs.forEach(buff => {
      // Stacked
      if (buff.mode === "stack" && buff.sum) {
        modifier += buff.stackValue;
      } else if (buff.mode === "constant" && buff.trigger === "debuff" && buff.sum) {
        modifier += this.getBuffs({ source: ABILITY_TYPE_DE_BUFF }).length ? buff.delta : 0;
      }
    });

    return modifier;
  }

  public addBuff(buff: BattleBuff): void {
    if (buff.source !== "terrain") {
      buff.activated = false;
    }
    
    if (buff.mode === "stack") {
      buff.stackValue = 0;
    }

    this.log(`Buff added (need commit)`, buff);
    this._buffs.push(buff);

    this.commit();
    this._events.buffs(this.fighterId, this.buffs);
    
    if (["power", "attack", "abilities"].includes(buff.type)) {
      this._events.abilities(this._fighterId, this.serializeAbilities());
    }
  };
  
  public removeBuffs(params: { source?: string, type?: string }): void {
    this.log(`Remove buffs`, params);
    this._buffs = this._buffs.filter(buff => {
      return !(buff.source === params.source && buff.type === params.type);
    });
  };

  public decreaseBuffsEstimate(): void {
    this._buffs.forEach(buff => {
      if (buff.source === "terrain") {
        return;
      }

      if (!buff.activated) {
        buff.activated = true;
        return;
      }

      if (
        _.isNumber(buff.estimate)
        &&
        buff.estimate >= 0
      ) {
        buff.estimate--;
      }
    });

    const filterFunc = buff => _.isNumber(buff.estimate) && buff.estimate < 0;
    const outdatedBuffs = _.remove(this._buffs, filterFunc);
    
    if (outdatedBuffs.length) {
      console.log(`Buffs outdated (need commit)`, { outdatedBuffs });
      this.commit();
    } 
  };

  public getAbilityRange(abilityClass: string, type: string): number {
    const abilityData = this.getAbilityByClass(abilityClass);
    const abilityMeta = ABILITIES[this.class][abilityClass];

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
        result = this.getValueByFormula(result);
      }
    }

    return result || 0;
  }

  public getAbilityIgnoreObstacles(abilityClass: string): boolean {
    const abilityData = this.getAbilityByClass(abilityClass);
    const abilityMeta = ABILITIES[this.class][abilityClass];

    let ignoreObstacles = abilityMeta.ignoreObstacles;
    return _.isArray(ignoreObstacles) ? 
      ignoreObstacles[abilityData.levelInt-1]
      :
      ignoreObstacles;
  }

  protected _getAbilityStat(abilityClass: string): BattleUnitAbilityStat {
    const abilityData = this.getAbilityByClass(abilityClass);
    const abilityMeta = ABILITIES[this.class][abilityClass];
    const effects = abilityMeta.effects.length ?
      abilityMeta.effects[abilityData.levelInt === 0 ? 0 : abilityData.levelInt - 1]
      :
      [];

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
  
  protected updateAbilities(): void {
    this._abilities.forEach(ability => {
      // Set ability stat
      this._abilitiesStat[ability.abilityClass] = this._getAbilityStat(ability.abilityClass);
      // Update ability value
      const abilityValue = this.getAbilityValue(ability.abilityClass);
      const abilityCombatValue = this.getAbilityCombatValue(ability.abilityClass);
      ability.value = abilityValue;
      ability.combatValue = abilityCombatValue === null ? abilityValue : abilityCombatValue;
    });
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

  public serializeAbilities(): BattleUnitAbility[] {
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

  public serializeForSquad(): BattleUnit {
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
      ratingIndex: this._ratingIndex,
      isStunned: this._isStunned,
      characteristics: this._characteristics,
      power: this._power,
      index: this._index,
      hp: this._hp,
      abilities: this.serializeAbilities(),
      buffs: this._buffs,
      info: this._info
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

    //BattleManager.log("addExpirience", "Expirience result", this._expirience);
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
    this.updateAbilities();

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

  public maximize() {
    this._tier = 3;
    this._levelInt = SETTINGS.maxUnitTierLevel[this._tier];
    this._level.current = SETTINGS.maxUnitTierLevel[this._tier];
    this._level.next = null;
    this._expirience.value = this.getExpForLevel(SETTINGS.maxUnitTierLevel[3]);
    this._expirience.currentLevelExp = 0;
    this._expirience.nextLevelExp = 0;

    if (false) {
      this._abilities.forEach(ability => {
        const abilityScheme = ABILITY_SCHEME[this._levelInt-1][ability.tier-1];
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

    this.updateAbilities();
    this.setPower();
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
    ability.levelInt++;

    const canUpgradeMore = ability.level.current < abilityScheme.lvl;
    ability.level.next = canUpgradeMore ? ability.level.next + 1 : null;
    ability.level.price = canUpgradeMore ? this.getAbilityUpgradePrice(ability.tier, ability.level.next) : null;

    this.updateAbilities();
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

  public getAbilityByClass(abilityClass: string): BattleUnitAbility {
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
        value: this._characteristics.damage,
        combatValue: this._characteristics.damage,
        enabled: true
      }
    }

    const ability = this._abilities ?
      this._abilities.find(entry => entry.abilityClass === abilityClass)
      :
      null;

    if (!ability) {
      throw new Error(`[Unit] Unit of class "${this._unitClass}" haven't ability "${abilityClass}"`);
    }
    
    return ability;
  }

  public setIndex(index: number): void {
    if (index < 0 || index > 34) {
      throw Error("[Unit] Unit index overflow");
    }
    this._index = index;
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

  public getLavaDamage(): number {
    return Math.round(this.maxHp * this.getTerrainModifier(TERRAIN_LAVA));
  }

  public launchTerrainEffect(terrain?: string): void {
    switch (terrain) {
      case TERRAIN_LAVA: {
        const damage = this.getLavaDamage();
        this.modifyHp(-damage);
        this.log(`Lava damage is ${damage}`);
        break;
      }
      case TERRAIN_ICE:
      case TERRAIN_SWAMP:
      case TERRAIN_HILL:
      case TERRAIN_WOODS: {
        // Remove existing TERRAIN_ICE and TERRAIN_SWAMP effects
        this.removeBuffs({
          source: "terrain",
          type: SETTINGS.terrain[terrain].type
        });
        
        // Hills, highlands - Increase damage to enemies by 25%
        // Forest - Increases unit's defense by 25%
        this.addBuff({
          source: "terrain",
          sourceId: terrain,
          mode: "constant",
          type: SETTINGS.terrain[terrain].type,
          modifier: this.getTerrainModifier(terrain),
          caseId: parseInt(this._terrainModifiers[terrain].split('-')[1])
        });
        break;
      }
      default: {
        this.removeBuffs({
          source: "terrain"
        });
        break;
      }
    }
  }

  public modifyHp(value: number): void {
    if (this._isDead) {
      return;
    }

    this._hp += value;

    if (this._hp <= 0) {
      this._isDead = true;
      if (this._isEnemy) {
        this._events.enemyFighter(this);
      } else {
        this._events.userFighter(this);
      }
    } else if (this._hp > this.maxHp) {
      this._hp = this.maxHp;
    }
  };

  public setRatingIndex(value: number) {
    this._ratingIndex = value;
  }

  public strongestEnabledAbility(): string {
    const enabledAbilities = this._abilities.filter(entry => {
      return entry.enabled && (!entry.cooldown || !entry.cooldown.enabled)
    }).map(entry => entry.abilityClass);
    
    return enabledAbilities.length ? _.last(enabledAbilities) : ABILITY_ATTACK;
  }

  public commit(initial?: boolean): void {
    this.log(`Commit start`, this.variables);

    this._buffs.forEach(buff => {
      // Terrain
      if (buff.terrain && buff.scheme) {
        this._terrainModifiers[buff.terrain] = buff.scheme;
      }
      // HP
      if (initial && buff.type === "hp") {
        this._hp = Math.round(this.maxHp * this.getBuffModifier({ type: "hp" }));
      }
    });
    
    // Characteristics
    this.modifiers.defence = this.getBuffModifier({ type: "defence" });
    this.modifiers.speed = this.getBuffModifier({ type: "speed" });
    this.modifiers.initiative = this.getBuffModifier({ type: "initiative" });

    // Attack bonuses
    this.modifiers.power = this.getBuffModifier({ type: "power" });
    this.modifiers.attack = this.getBuffModifier({ type: "attack" });
    this.modifiers.abilities = this.getBuffModifier({ type: "abilities" });
    
    // Stun
    const stunBuffs = this.getBuffs({ type: "stun" });
    if (stunBuffs.length) {
      this._isStunned = stunBuffs.some(buff => Math.random() <= buff.probability);
    } else {
      this._isStunned = false;
    }

    this.updateAbilities();
    this.setPower();

    this.log(`Commit finish`, this.variables);
  }

  public resetBuffs(): void {
    this._buffs = [];
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

  public getTerrainModifier(terrain: string): number {
    return SETTINGS.terrain[terrain].modifiers[
      this._terrainModifiers[terrain]
    ]  
  }

  public setTerrainModifier(terrain: string, value: number): void {
    this._terrainModifiers[terrain] = value;
  }

  public getValueByFormula(formula: string) {
    return {
      "speed-1": this._characteristics.speed - 1,
      "speed":   this._characteristics.speed,
      "speed+1": this._characteristics.speed + 1,
      "speed+2": this._characteristics.speed + 2,
      "speed+3": this._characteristics.speed + 3
    }[formula];
  }

  protected log(message: string, payload?: any) {
    //console.log(`[Unit id=${this._unitId} fighterId=${this._fighterId}] ${message}`, payload);
  }
}