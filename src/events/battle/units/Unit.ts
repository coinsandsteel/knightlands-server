import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { UNIT_CLASS_SUPPORT } from "../../../knightlands-shared/battle";
import {
  ABILITIES,
  ABILITY_GROUPS, ABILITY_LEVEL_UP_PRICES, CHARACTERISTICS,
  UNIT_EXP_TABLE,
  UNIT_LEVEL_UP_PRICES
} from "../meta";
import {
  BattleBuff, BattleLevelScheme,
  BattleUnit, BattleUnitAbility,
  BattleUnitCharacteristics
} from "../types";

export class Unit {
  protected _template: number;
  protected _unitId: string;
  protected _unitTribe: string; // 15
  protected _unitClass: string; // 5
  protected _tier: number; // 3, modify via merger (3 => 1)
  protected _level: BattleLevelScheme; // exp > max limit > pay coins > lvl up > characteristics auto-upgrade
  protected _levelInt: Number;
  protected _power: number;
  protected _expirience: {
    value: number;
    percentage: number;
    currentLevelExp: number;
    nextLevelExp: number;
  };
  protected _characteristics: BattleUnitCharacteristics;
  protected _abilityList: string[];
  protected _abilities: BattleUnitAbility[];
  protected _quantity: number;
  
  // Combat
  protected _hp: number;
  protected _damage: number;
  protected _defence: number;
  protected _initiative: number;
  protected _speed: number;

  protected _index: number;
  protected _buffs: BattleBuff[];

  get tier(): number {
    return this._tier;
  }

  get tribe(): string {
    return this._unitTribe;
  }

  get class(): string {
    return this._unitClass;
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

  constructor(blueprint: BattleUnit) {
    this._template = blueprint.template;
    this._unitId = blueprint.unitId || uuidv4().split('-').pop();
    this._unitTribe = blueprint.unitTribe;
    this._unitClass = blueprint.unitClass;
    
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
    }
    
    if ("expirience" in blueprint) {
      this._expirience = blueprint.expirience;
    } else {
      this._expirience = {
        value: 0,
        percentage: 0,
        currentLevelExp: 0,
        nextLevelExp: _.cloneDeep(UNIT_EXP_TABLE[this._tier - 1][1])
      };
    }

    if ("characteristics" in blueprint) {
      this._characteristics = blueprint.characteristics;
    } else {
      const characteristicsMeta = _.cloneDeep(CHARACTERISTICS[this._unitClass][this._tier - 1][this._level.current - 1]);
      this._characteristics = {...this._characteristics, ...characteristicsMeta};
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
          abilityGroup: _.cloneDeep(ABILITY_GROUPS[abilityClass]),
          tier,
          levelInt: !index ? 1 : 0,
          level: {
            current: !index ? 1 : 0, // Unlock only the first ability
            next: !index ? 2 : null,
            price: !index ? this.getAbilityUpgradePrice(tier, 2) : null,
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
    }

    if ("hp" in blueprint) {
      this._hp = blueprint.hp;
    }

    if ("buffs" in blueprint) {
      this._buffs = blueprint.buffs;
    }

    this.setPower();
  }

  protected getAbilityValue(ability: string, level?: number): number|null {
    if (this._unitClass === UNIT_CLASS_SUPPORT) {
      return 1;
    }

    const abilityData = _.cloneDeep(ABILITIES[this._unitClass][ability]);
    if (!abilityData) {
      return 1;
    }

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
        abilityGroup: ability.abilityGroup,
        tier: ability.tier,
        value: ability.value,
        enabled: !!ability.level.current,
        cooldown: {
          enabled: false,
          stepsLeft: 0,
          stepsMax: 0
        }
      } as BattleUnitAbility;
    });

    const squadUnit = {
      template: this._template,
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
    if (this._level.next) {
      return;
    }

    this._expirience.value += value;

    let expTable = _.cloneDeep(UNIT_EXP_TABLE[this._tier - 1]);
    let priceTable = _.cloneDeep(UNIT_LEVEL_UP_PRICES[this._tier - 1]);
    
    let currentExp = this._expirience.value;
    let currentLevel = this._level.current - 1;
    let newLevel = currentLevel + 1;
    let currentLevelExpStart = expTable[currentLevel];
    let currentLevelExpEnd = expTable[newLevel];

    while (expTable[newLevel] <= this._expirience.value) {
      currentLevelExpStart = expTable[newLevel];
      currentLevelExpEnd = expTable[newLevel + 1];
      newLevel++;
    }

    if (newLevel > currentLevel + 1) {
      this._level.next = newLevel;
      this._level.price = priceTable[newLevel-1];
    } else {
      this._level.next = null;
      this._level.price = null;
    }

    let expGap = currentLevelExpEnd - currentLevelExpStart;
    let currentGap = currentExp - currentLevelExpStart;

    this._expirience.percentage = Math.floor(
      currentGap * 100 / expGap
    );
    this._expirience.currentLevelExp = currentGap;
    this._expirience.nextLevelExp = expGap;

    console.log("[addExpirience] Expirience result", this._expirience);
  }

  public upgradeLevel(): boolean {
    if (!this.canUpgradeLevel()) {
      return false;
    }

    this._level.current = this._level.next;
    this._level.next = null;
    this._level.price = null;

    this.setPower();
    this.unblockAbilities();

    return true;
  }

  protected unblockAbilities(): void {
    let abilityTier = 2;
    if (
      this._level.current >= 3
      &&
      this._abilities[abilityTier-1].level.current === 0
    ) {
      // Unlock tier 2 ability
      this._abilities[abilityTier-1].level.current = 1;
      this._abilities[abilityTier-1].level.next = 2;
      this._abilities[abilityTier-1].level.price = this.getAbilityUpgradePrice(abilityTier, 2);
      console.log("[Unit] Ability tier 2 unlocked");
    }
    
    abilityTier = 3;
    if (
      this._level.current >= 5
      &&
      this._abilities[abilityTier-1].level.current === 0
      ) {
        // Unlock tier 3 ability
        this._abilities[abilityTier-1].level.current = 1;
        this._abilities[abilityTier-1].level.next = 2;
        this._abilities[abilityTier-1].level.price = this.getAbilityUpgradePrice(abilityTier, 2);
        console.log("[Unit] Ability tier 3 unlocked");
    }
  }

  public canUpgradeLevel(): boolean {
    return !!this._level.next;
  }

  public upgradeAbility(abilityClass: string): boolean {
    if (!this.canUpgradeAbility(abilityClass)) {
      return false;
    }

    const ability = this._abilities.find(entry => entry.abilityClass === abilityClass);
    ability.level.current++;
    ability.level.next = ability.level.next + 1;
    ability.level.price = this.getAbilityUpgradePrice(ability.tier, ability.level.next);

    this.setPower();

    return true;
  }

  protected getAbilityUpgradePrice(tier: number, level: number){
    return _.cloneDeep(ABILITY_LEVEL_UP_PRICES[tier-1][level-1]);
  }

  public canUpgradeAbility(abilityClass: string): boolean {
    const ability = this.getAbilityByClass(abilityClass);
    return !!ability && !!ability.level.next;
  }

  public getAbilityByClass(abilityClass: string): BattleUnitAbility|null {
    const ability = this._abilities.find(entry => entry.abilityClass === abilityClass);
    return ability || null;
  }
}