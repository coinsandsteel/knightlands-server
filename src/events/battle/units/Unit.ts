import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { UNIT_CLASS_SUPPORT } from "../../../knightlands-shared/battle";
import errors from "../../../knightlands-shared/errors";
import random from "../../../random";
import { ABILITIES, ABILITY_GROUPS, CHARACTERISTICS, EXP_TABLE } from "../meta";
import { BattleInventory } from "../services/BattleInventory";
import { 
  BattleInventoryUnit, 
  BattleLevelScheme, 
  BattleUnitBlueprint, 
  BattleUnitCharacteristics, 
  InventoryUnitAbility 
} from "../types";

export class Unit {
  private _inventory: BattleInventory;

  private _template: number;
  private _unitId: string;
  private _unitTribe: string; // 15
  private _unitClass: string; // 5
  private _tier: number; // 3, modify via merger (3 => 1)
  private _level: BattleLevelScheme; // exp > max limit > pay coins > lvl up > characteristics auto-upgrade
  //  current: number;
  //  next: number|null;
  //  price: number|null;
  //};
  private _power: number;
  private _expirience: {
    value: number;
    percentage: number;
    currentLevelExp: number;
    nextLevelExp: number;
  };
  private _characteristics: BattleUnitCharacteristics;
  private _abilities: InventoryUnitAbility[];
  private _quantity: number;

  private _hp: number;
  private _damage: number;
  private _defence: number;
  private _initiative: number;
  private _speed: number;

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

    if ("level" in blueprint) {
      this._level = blueprint.level;
      this._expirience = blueprint.expirience;
      this._characteristics = blueprint.characteristics;
      this._abilities = blueprint.abilities;
      this._quantity = blueprint.quantity;

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
        nextLevelExp: _.cloneDeep(EXP_TABLE[this._tier - 1][1])
      };

      const characteristicsMeta = _.cloneDeep(CHARACTERISTICS[this._unitClass][this._tier - 1][this._level.current - 1]);
      this._characteristics = {...this._characteristics, ...characteristicsMeta};

      const firstTierAbility = _.cloneDeep(blueprint.abilityList[0]);
      this._abilities = [
        {
          abilityClass: firstTierAbility,
          abilityGroup: _.cloneDeep(ABILITY_GROUPS[firstTierAbility]),
          level: {
            current: 1,
            next: null,
            price: null
          },
          value: this.getAbilityValue(firstTierAbility, 1)
        },
      ];
    }

    this.setPower();
  }

  protected getAbilityValue(ability: string, level?: number): number {
    if (this._unitClass === UNIT_CLASS_SUPPORT) {
      return 1;
    }

    const abilityData = _.cloneDeep(ABILITIES[this._unitClass][ability]);
    if (!abilityData) {
      return 1;
    }

    const abilityValue = abilityData[this._tier - 1][level - 1];
    if (!abilityValue) {
      return 1;
    }

    return abilityValue;
  }

  protected setPower() {
    this._power = 
      this._characteristics.hp + 
      this._characteristics.damage + 
      this._characteristics.defence + 
      this._characteristics.initiative + 
      this._characteristics.speed;
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

  public updateQuantity(value: number): void {
    this._quantity += value;
  }

  public addExpirience(value): void {
    if (this._level.next) {
      return;
    }

    this._expirience.value += value;

    let expTable = EXP_TABLE[this._tier - 1];
    
    let currentExp = this._expirience.value;
    let currentLevel = this._level.current - 1;
    let newLevel = currentLevel + 1;
    let currentLevelExpStart = expTable[currentLevel];
    let currentLevelExpEnd = expTable[newLevel];

    console.log("[addExpirience] Prerequisites", {
      currentExp,
      currentLevel,
      newLevel,
      currentLevelExpStart,
      currentLevelExpEnd,
    });

    while (expTable[newLevel] < this._expirience.value) {
      currentLevelExpStart = expTable[newLevel];
      currentLevelExpEnd = expTable[newLevel + 1];
      newLevel++;
      console.log("[addExpirience] While", {
        m1: expTable[newLevel],
        m2: this._expirience.value,
        currentLevelExpStart,
        currentLevelExpEnd,
        newLevel
      });
    }

    if (newLevel > currentLevel + 1) {
      this._level.next = newLevel - 1;
      this._level.price = 1000;
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
  
    this._inventory.events.updateUnit(this);
  }

  public upgradeLevel(): boolean {
    if (!this.canUpgradeLevel()) {
      return false;
    }
    this._level.current = this._level.next;
    this._level.next = null;
    this._level.price = null;

    return true;
  }

  public canUpgradeLevel(): boolean {
    return !!this._level.next;
  }

  public upgradeAbility(abilityClass: string): boolean {
    if (!this.canUpgradeAbility(abilityClass)) {
      return false;
    }

    const ability = this._abilities.find(entry => entry.abilityClass === abilityClass);
    ability.level.current = ability.level.next;
    ability.level.next = null;
    ability.level.price = null;

    return true;
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