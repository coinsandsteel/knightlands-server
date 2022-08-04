import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { ABILITY_ATTACK, ABILITY_MOVE, ABILITY_TYPES, ABILITY_TYPE_ATTACK } from "../../../knightlands-shared/battle";
import { BattleEvents } from "../BattleEvents";
import {
  ABILITIES,
  ABILITY_LEVEL_UP_PRICES, 
  ABILITY_SCHEME, 
  AVG_DMG, 
  AVG_HP, 
  BUFF_SOURCE_BUFF, 
  BUFF_SOURCE_DE_BUFF, 
  BUFF_SOURCE_SELF_BUFF, 
  BUFF_SOURCE_TERRAIN, 
  CHARACTERISTICS,
  SETTINGS,
  TERRAIN_HILL,
  TERRAIN_ICE,
  TERRAIN_LAVA,
  TERRAIN_SWAMP,
  TERRAIN_WOODS,
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
  protected _quantity: number;
  
  // Combat
  protected _ratingIndex: number;
  protected _hp: number;
  protected _index: number;
  protected _buffs: BattleBuff[] = [
    // Attack
    //{ source: "squad", mode: "burst", type: "power", modifier: 1.3, probability: 0.07 },
    //{ source: "self-buff", mode: "constant", type: "power", modifier: 1.15 },
    //{ source: "squad", mode: "constant", type: "power", terrain: "hill", scheme: "hill-1" },
    // { source: "squad", mode: "stack", type: "power", trigger: "damage", delta: 2.5, percents: true, max: 15 },
    
    //{ source: "squad", mode: "stack", type: "attack", trigger: "damage", delta: 2.5, percents: true, max: 15 },
    //{ source: "squad", mode: "constant", type: "attack", modifier: 1.5 },
   
    //{ source: "squad", mode: "constant", type: "abilities", modifier: 1.05 },

    // Defence
    //{ source: "squad", mode: "stack", type: "defence", trigger: "damage", delta: 1, max: 4 },
    //{ source: "buff", mode: "constant", type: "defence", modifier: 1.75, estimate: 1 },
    //{ source: "buff", mode: "constant", type: "defence", modifier: 1.15 },
    //{ source: "squad", mode: "constant", type: "defence", terrain: "woods", scheme: "woods-1" },
    //{ source: "squad", mode: "constant", type: "defence", terrain: "ice", scheme: "ice-1" },
    //{ source: "squad", mode: "constant", type: "defence", modifier: 1.05 },
    //{ source: "terrain", mode: "constant", type: "defence", terrain: "woods", scheme: "woods-1" },
   
    // Speed
    //{ source: "squad", mode: "stack", type: "speed", trigger: "debuff", delta: 1 },
    //{ source: "squad", mode: "constant", type: "speed", terrain: "swamp", scheme: "swamp-1" },
    //{ source: "squad", mode: "constant", type: "speed", terrain: "swamp", scheme: "swamp-1" },
    //{ source: "de-buff", mode: "constant", type: "speed", modifier: 0.8 },
    //{ source: "self-buff", mode: "constant", type: "speed", modifier: 1.2 },
    //{ source: "terrain", mode: "constant", type: "speed", terrain: "swamp", scheme: "swamp-1", estimate: 1 },
    
    // Initiative
    //{ source: "buff", mode: "constant", type: "initiative", modifier: 0.8 },
    
    // Squad bonus
    //{ source: "squad", mode: "constant", type: "hp", modifier: 1.05 },
    //{ source: "squad", mode: "constant", type: "hp", modifier: 1.05 },
    
    // Damage
    //{ source: "terrain", mode: "constant", type: "damage", terrain: "ice", scheme: "ice-1" },
    //{ source: "terrain", mode: "constant", type: "damage", terrain: "hill", scheme: "hill-1" },
    { source: "squad", mode: "constant", type: "lava_damage", terrain: "lava", scheme: "lava-1" },
    
    // State
    { source: "de-buff", mode: "constant", type: "stun", probability: 1, estimate: 1 }, 
    { source: "de-buff", mode: "constant", type: "stun", probability: 0.25, estimate: 2 },
    { source: "de-buff", mode: "constant", type: "agro", probability: 1, estimate: 1 }, 
    { source: "de-buff", mode: "constant", type: "agro", probability: 0.10, estimate: 2 },
    { source: "squad", mode: "burst", type: "counter_attack", probability: 0.07 },
  ];

  protected _moveCells: number[];
  protected _attackCells: number[];

  protected _terrainModifiers = {
    [TERRAIN_ICE]: "ice-0",
    [TERRAIN_HILL]: "hill-0",
    [TERRAIN_WOODS]: "woods-0",
    [TERRAIN_SWAMP]: "swamp-0",
    [TERRAIN_LAVA]: "lava-0"
  }; 

  public result: {
    speed: number;
    initiative: number;
    defence: number;
    damage: number;
    powerBonus: number;
    attackBonus: number;
    abilitiesBonus: number;
    abilities: { 
      [abilityClass: string]: BattleUnitAbilityStat 
    }
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

  get abilities(): BattleUnitAbility[] {
    return this._abilities;
  }

  get isStunned(): boolean {
    // TODO stun
    return false;
  }

  constructor(blueprint: BattleUnit, events: BattleEvents) {
    this._events = events;

    this.result = {
      speed: 0,
      initiative: 0,
      defence: 0,
      damage: 0,
      powerBonus: 0,
      attackBonus: 0,
      abilitiesBonus: 0,
      abilities: {}
    };
      
    this._template = blueprint.template;
    this._unitId = blueprint.unitId || uuidv4().split('-').pop();
    this._unitTribe = blueprint.unitTribe;
    this._unitClass = blueprint.unitClass;
    
    if ("ratingIndex" in blueprint) {
      this._ratingIndex = blueprint.ratingIndex;
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
      this._hp = this._characteristics.hp;
    }

    if ("buffs" in blueprint) {
      this._buffs = blueprint.buffs;
    } else {
      this._buffs = [];
    }
    
    this.calcResult();
    this.setPower();
  }

  public reset(): void {
    this._isDead = false;
    
    this._abilities.forEach(ability => {
      delete ability.cooldown;
    });

    this.resetBuffs();
    this.calcResult(true);
  }
  
  public regenerateFighterId(): void {
    this._fighterId = uuidv4().split('-').pop();
  }

  public getAbilityValue(ability: string): number|null {
    let base = 0;
    
    if (ability === ABILITY_ATTACK) {
      base = this.damage;
    } else {
      const abilityData = this.getAbilityByClass(ability);
      const abilityLevel = abilityData.levelInt !== 0 ? abilityData.levelInt : 1;
      if (!ABILITIES[this._unitClass][ability]) {
        throw Error(`Unit ${this._unitClass} hasn't "${ability}" ability`);
      }
      if (!ABILITIES[this._unitClass][ability].damage[this._tier - 1]) {
        return 0;
      }
      base = ABILITIES[this._unitClass][ability].damage[this._tier - 1][abilityLevel - 1];
    }

    let abilityValue = 0;
    if (ability === ABILITY_ATTACK) {
      abilityValue = base * this.result.powerBonus * this.result.attackBonus;
    } else {
      abilityValue = base * this.result.powerBonus * this.result.abilitiesBonus;
    }
    
    console.log(`[Unit #${this._fighterId}] Ability "${ability}" value: base=${base} * power=${this.result.powerBonus} * attack=${this.result.attackBonus} * abilities=${this.result.abilitiesBonus} = ${abilityValue}`);

    return Math.round(abilityValue);
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

        console.log(`[Unit #${this._fighterId}] Ability cooldown updated`, {
          ability: ability.abilityClass,
          newValue: newCooldown,
          cooldownEnabled: ability.cooldown.enabled
        });
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
          buff.stackValue < buff.max
        ) {
          buff.stackValue += buff.delta * (buff.percents ? 0.01 : 1);
          console.log(`[Unit #${this._fighterId}] ${buff.type} stacked`, buff);
        }
      });
    }
  }

  public buff(buff: BattleBuff): void {
    if (buff.type === "stack") {
      buff.stackValue = 1 + buff.delta * (buff.percents ? 0.01 : 1);
    }

    console.log(`[Unit #${this._fighterId}] Buff added`, buff);
    this._buffs.push(buff);

    this.calcResult();
    this._events.buffs(this.fighterId, this.buffs);
    
    if (["power", "attack", "abilities"].includes(buff.type)) {
      this._events.abilities(this._fighterId, this.serializeAbilities());
    }
  };

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
      if (buff.mode === "constant") {
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
      } else if (buff.mode === "stack") {
        modifier = modifier * buff.stackValue;
      }
    });

    return modifier;
  }

  public removeBuffs(params: { source?: string, type?: string }): void {
    console.log(`[Unit #${this._fighterId}] Remove buffs`, params);
    this._buffs = _.remove(this._buffs, params);
  };

  public decreaseBuffsEstimate(): void {
    this._buffs.forEach(buff => {
      if (
        _.isNumber(buff.estimate)
        &&
        buff.estimate >= 0
      ) {
        buff.estimate--;
      }
    });

    this._buffs = _.remove(
      this._buffs, 
      buff => _.isNumber(buff.estimate) && buff.estimate < 0
    );

    this.calcResult();
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

  public getAbilityStat(abilityClass: string, force?: boolean): BattleUnitAbilityStat {
    if (!force && this.result.abilities[abilityClass]) {
      return this.result.abilities[abilityClass];
    }

    const abilityData = this.getAbilityByClass(abilityClass);
    const abilityMeta = ABILITIES[this.class][abilityClass];
    const effects = abilityData ?
      abilityMeta.effects[abilityData.levelInt-1]
      :
      [];

    const abilityStat = {
      ...abilityMeta,
      damage: this.getAbilityValue(abilityClass),
      moveRange: this.getAbilityRange(abilityClass, "move"),
      attackRange: this.getAbilityRange(abilityClass, "attack"),
      ignoreObstacles: this.getAbilityIgnoreObstacles(abilityClass),
      effects
    } as BattleUnitAbilityStat;

    this.result.abilities[abilityClass] = abilityStat;

    return abilityStat;
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
        enabled: ability.enabled,
        cooldown: {
          enabled: false,
          estimate: 0
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
      characteristics: this._characteristics,
      power: this._power,
      index: this._index,
      hp: this._hp,
      abilities: this.serializeAbilities(),
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
          ability.levelInt = 1;
          ability.value = this.getAbilityValue(ability.abilityClass);
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
    ability.levelInt++;
    ability.value = this.getAbilityValue(abilityClass);

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

  public getLavaDamage(): number {
    // TODO add bonus
    return Math.round(this._characteristics.hp * SETTINGS.lavaDamage);
  }

  public launchTerrainEffect(terrain?: string): void {
    switch (terrain) {
      case TERRAIN_LAVA: {
        const damage = this.getLavaDamage();
        this.modifyHp(-damage);
        console.log(`[Unit #${this._fighterId}] Lava damage is ${damage}`);
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
        this.buff({
          source: "terrain",
          mode: "constant",
          type: SETTINGS.terrain[terrain].type,
          modifier: this.getTerrainModifier(terrain)
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

  public calcResult(initial?: boolean): void {
    this.result.defence = Math.round(this.getBuffModifier({ type: "defence" }));
    this.result.speed = Math.round(this.getBuffModifier({ type: "speed" }));
    this.result.initiative = Math.round(this.getBuffModifier({ type: "initiative" }));

    this.result.powerBonus = this.getBuffModifier({ type: "power" });
    this.result.attackBonus = this.getBuffModifier({ type: "attack" });
    this.result.abilitiesBonus = this.getBuffModifier({ type: "abilities" });
    
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
    
    // Abilities value
    this._abilities.forEach(ability => {
      // Set value
      ability.value = this.getAbilityValue(ability.abilityClass);
      // Set ability stat
      this.result.abilities[ability.abilityClass] = this.getAbilityStat(ability.abilityClass, true);
    });

    console.log(`[Unit #${this._fighterId}] Unit stats recalculated`, {
      ...this.result,
      terrainModifiers: this._terrainModifiers
    });
  }

  public resetBuffs(): void {
    this.removeBuffs({ source: BUFF_SOURCE_TERRAIN });
    this.removeBuffs({ source: BUFF_SOURCE_BUFF });
    this.removeBuffs({ source: BUFF_SOURCE_DE_BUFF });
    this.removeBuffs({ source: BUFF_SOURCE_SELF_BUFF });
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
      "speed-1": this.speed - 1,
      "speed":   this.speed,
      "speed+1": this.speed + 1,
      "speed+2": this.speed + 2,
      "speed+3": this.speed + 3
    }[formula];
  }
}