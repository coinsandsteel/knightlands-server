import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { UNIT_CLASS_SUPPORT } from "../../../knightlands-shared/battle";
import { BattleInventory } from "../services/BattleInventory";
import random from "../../../random";
import { 
  ABILITIES,
  ABILITY_GROUPS,
  CHARACTERISTICS,
  UNIT_EXP_TABLE,
  UNIT_LEVEL_UP_PRICES,
  ABILITY_LEVEL_UP_PRICES
} from "../meta";
import { 
  BattleBuff,
  BattleInventoryUnit, 
  BattleLevelScheme, 
  BattleSquadUnit, 
  BattleUnitAbility, 
  BattleUnitBlueprint, 
  BattleUnitCharacteristics, 
  InventoryUnitAbility 
} from "../types";

export class Unit {
  protected _inventory: BattleInventory;

  protected _template: number;
  protected _unitId: string;
  protected _unitTribe: string; // 15
  protected _unitClass: string; // 5
  protected _tier: number; // 3, modify via merger (3 => 1)
  protected _level: BattleLevelScheme; // exp > max limit > pay coins > lvl up > characteristics auto-upgrade
  protected _power: number;
  protected _expirience: {
    value: number;
    percentage: number;
    currentLevelExp: number;
    nextLevelExp: number;
  };
  protected _characteristics: BattleUnitCharacteristics;
  protected _abilities: InventoryUnitAbility[];
  protected _quantity: number;
  
  protected _hp: number;
  protected _damage: number;
  protected _defence: number;
  protected _initiative: number;
  protected _speed: number;

  protected _index: number;
  protected _buffs: BattleBuff[];

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

  constructor(blueprint: BattleUnitBlueprint|BattleInventoryUnit, inventory: BattleInventory) {
    this._inventory = inventory;

    this._template = blueprint.template;
    this._unitId = blueprint.unitId || uuidv4().split('-').pop();
    this._unitTribe = blueprint.unitTribe;
    this._unitClass = blueprint.unitClass;
    this._tier = blueprint.tier || random.intRange(1, 3);

    // Existing
    if ("level" in blueprint) {
      this._level = blueprint.level;
      this._expirience = blueprint.expirience;
      this._characteristics = blueprint.characteristics;
      this._abilities = blueprint.abilities;
      this._quantity = blueprint.quantity;
      
    // New
    } else {
      this._quantity = 1;

      this._level = {
        current: 1,
        next: null,
        price: null
      } as BattleLevelScheme;

      this._expirience = {
        value: 0,
        percentage: 0,
        currentLevelExp: 0,
        nextLevelExp: _.cloneDeep(UNIT_EXP_TABLE[this._tier - 1][1])
      };

      const characteristicsMeta = _.cloneDeep(CHARACTERISTICS[this._unitClass][this._tier - 1][this._level.current - 1]);
      this._characteristics = {...this._characteristics, ...characteristicsMeta};

      const abilityList = _.cloneDeep(blueprint.abilityList);
      const abilities = abilityList.map((abilityClass, index) => {
        let tier = index + 1;
        return {
          abilityClass,
          abilityGroup: _.cloneDeep(ABILITY_GROUPS[abilityClass]),
          tier,
          level: {
            current: !index ? 1 : 0, // Unlock only the first ability
            next: !index ? 2 : null,
            price: !index ? this.getAbilityUpgradePrice(tier, 2) : null,
          },
          value: this.getAbilityValue(abilityClass, 1)
        };
      });

      this._abilities = abilities;
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
    
  public serialize(): BattleInventoryUnit {
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
    } as BattleInventoryUnit;

    return _.cloneDeep(unit);
  }

  public serializeForSquad(): BattleSquadUnit {
    const abilities = this._abilities.map(ability => {
      return {
        abilityClass: ability.abilityClass,
        abilityGroup: ability.abilityGroup,
        tier: ability.tier,
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
      index: this._index,
      hp: this._hp,
      abilities,
      buffs: this._buffs
    } as BattleSquadUnit;

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

    return true;
  }

  protected getAbilityUpgradePrice(tier: number, level: number){
    return _.cloneDeep(ABILITY_LEVEL_UP_PRICES[tier-1][level-1]);
  }

  public canUpgradeAbility(abilityClass: string): boolean {
    const ability = this.getAbilityByClass(abilityClass);
    return !!ability && !!ability.level.next;
  }

  public getAbilityByClass(abilityClass: string): InventoryUnitAbility|null {
    const ability = this._abilities.find(entry => entry.abilityClass === abilityClass);
    return ability || null;
  }
}