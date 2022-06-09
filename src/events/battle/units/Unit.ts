import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { UNIT_CLASS_SUPPORT } from "../../../knightlands-shared/battle";
import random from "../../../random";
import { ABILITIES, ABILITY_GROUPS, CHARACTERISTICS, EXP_TABLE } from "../meta";
import { 
  BattleInventoryUnit, 
  BattleLevelScheme, 
  BattleUnitBlueprint, 
  BattleUnitCharacteristics, 
  InventoryUnitAbility 
} from "../types";

export class Unit {
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
    current: number; // gained value (relative)
    max: number; // full value (relative)
  };
  private _characteristics: BattleUnitCharacteristics;
  private _abilities: InventoryUnitAbility[];
  private _quantity: number;

  private _hp: number;
  private _damage: number;
  private _defence: number;
  private _initiative: number;
  private _speed: number;

  get template(): number {
    return this._template;
  }

  get quantity(): number {
    return this._quantity;
  }

  constructor(blueprint: BattleUnitBlueprint|BattleInventoryUnit) {
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
        current: 0,
        max: _.cloneDeep(EXP_TABLE[this._tier - 1][1])
      };

      const characteristicsMeta = _.cloneDeep(CHARACTERISTICS[this._unitClass][this._tier - 1][this._level.current - 1]);
      this._characteristics = {...this._characteristics, ...characteristicsMeta};

      const firstTierAbility = _.cloneDeep(blueprint.abilityList[0]);
      console.log({
        firstTierAbility,
        unitClass: this._unitClass
      });
      const abilityValue = this._unitClass === UNIT_CLASS_SUPPORT ? 
        1
        :
        _.cloneDeep(ABILITIES[this._unitClass][firstTierAbility][this._tier - 1][0]);

      this._abilities = [
        {
          abilityClass: firstTierAbility,
          abilityGroup: _.cloneDeep(ABILITY_GROUPS[firstTierAbility]),
          level: {
            current: 1,
            next: null,
            price: null
          },
          value: abilityValue
        },
      ];
    }

    this.setPower();
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
  
  /*public serializeForSquad(): BattleSquadUnit {
    const unit = {
      template: this._template,
      unitId: this._unitId,
      unitTribe: this._unitTribe,
      unitClass: this._unitClass,
      tier: this._tier,
      index: this._index,
      hp: this._hp,
      abilities: this._abilities,
      activeBuffs: []
    } as BattleSquadUnit;
    
    return _.cloneDeep(unit);
  }*/

  public updateQuantity(value: number): void {
    this._quantity += value;
  }
}