import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { BattleEvents } from "../services/BattleEvents";
import { SETTINGS, UNIT_LEVEL_UP_PRICES } from "../meta";
import {
  BattleLevelScheme,
  BattleUnit,
  BattleUnitCharacteristics,
} from "../types";
import game from "../../../game";
import UnitAbilities from "./UnitAbilities";
import { BattleUnitMeta } from "./MetaDB";

export class Unit {
  protected _events: BattleEvents;

  protected _unitId: string;
  protected _template: number;
  protected _tribe: string;
  protected _class: string;
  protected _name: string;
  protected _tier: number;

  protected _level: BattleLevelScheme;
  protected _levelInt: number;

  protected _power: number;
  protected _expirience: {
    value: number;
    currentLevelExp: number;
    nextLevelExp: number;
  };
  protected _characteristics: BattleUnitCharacteristics;
  protected _quantity: number;

  protected _abilities: UnitAbilities;

  get abilities(): UnitAbilities {
    return this._abilities;
  }

  get name(): string {
    return this._name;
  }

  get tier(): number {
    return this._tier;
  }

  get tribe(): string {
    return this._tribe;
  }

  get class(): string {
    return this._class;
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

  get levelInt(): number {
    return this._levelInt;
  }

  get power(): number {
    return this._power;
  }

  get speed(): number {
    return this._characteristics.speed;
  }

  get damage(): number {
    return this._characteristics.damage;
  }

  get maxHp(): number {
    return this._characteristics.hp;
  }

  get characteristics(): BattleUnitCharacteristics {
    return this._characteristics;
  }

  constructor(blueprint: BattleUnit, events: BattleEvents) {
    this._unitId = blueprint.unitId;
    this._template = blueprint.template;
    this._tribe = blueprint.tribe;
    this._class = blueprint.class;
    this._name = blueprint.name;
    this._tier = blueprint.tier;
    this._level = blueprint.level;
    this._levelInt = blueprint.levelInt;
    this._power = blueprint.power;
    this._expirience = blueprint.expirience;
    this._characteristics = blueprint.characteristics;
    this._quantity = blueprint.quantity;

    this._abilities = new UnitAbilities(this, blueprint.abilities);
    this._events = events;

    this.commit();
  }

  public static createUnit(meta: BattleUnitMeta, events: BattleEvents): Unit {
    const blueprint = {
      unitId: uuidv4().split("-").pop(),
      template: meta._id,
      tribe: meta.tribe,
      class: meta.class,
      name: meta.name,
      tier: meta.tier,
      level: {
        current: 1,
        next: null,
        price: null,
      } as BattleLevelScheme,
      levelInt: 1,
      power: 0,
      expirience: {
        value: 0,
        currentLevelExp: 0,
        nextLevelExp: Unit.getExpForLevel(2),
      },
      characteristics: Unit.getCharacteristics(meta._id, 1),
      abilities: meta.abilityList.map((abilityClass) =>
        UnitAbilities.createEmptyBlueprint(abilityClass)
      ),
      quantity: 1,
    } as BattleUnit;

    return new Unit(blueprint, events);
  }

  public reset(): void {
    this.abilities.reset();
    this.commit();
  }

  public setPower() {
    const statsSum =
      this._characteristics.hp +
      this._characteristics.damage +
      this._characteristics.defence +
      this._characteristics.initiative +
      this._characteristics.speed;

    const abilitySum = this.abilities.getPower();
    this._power = (statsSum + abilitySum) * 2;
  }

  public serialize(): BattleUnit {
    const unit = {
      name: this._name,
      unitId: this._unitId,

      template: this._template,
      tribe: this._tribe,
      class: this._class,
      tier: this._tier,

      level: this._level,
      levelInt: this._level.current,

      power: this._power,
      expirience: this._expirience,
      characteristics: this._characteristics,
      abilities: this.abilities.serialize(),
      quantity: this._quantity,
    } as BattleUnit;

    return _.cloneDeep(unit);
  }

  public updateQuantity(value: number): void {
    this._quantity += value;
  }

  public addExpirience(value: number): void {
    if (this._tier === 1 && this._levelInt >= SETTINGS.maxUnitTierLevel[1]) {
      return;
    }

    if (this._tier === 2 && this._levelInt >= SETTINGS.maxUnitTierLevel[2]) {
      return;
    }

    this._expirience.value += value;

    const lastLevelExpEnd = Unit.getExpForLevel(SETTINGS.maxUnitTierLevel[3]);
    if (
      this._levelInt >= SETTINGS.maxUnitTierLevel[3] - 1 &&
      this._expirience.value > lastLevelExpEnd
    ) {
      this._expirience.value = lastLevelExpEnd;
      return;
    }

    let priceTable = _.cloneDeep(UNIT_LEVEL_UP_PRICES);

    let currentExp = this._expirience.value;
    let currentLevel = this._level.current;
    let newLevel = currentLevel + 1;

    let currentLevelExpStart = Unit.getExpForLevel(currentLevel);
    let currentLevelExpEnd = Unit.getExpForLevel(newLevel);

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

    this.abilities.update();

    return true;
  }

  public setLevel(value: number): void {
    this._levelInt = value;
    this._level.current = value;
    this._level.next = null;
    this._level.price = null;
  }

  public static getCharacteristics(
    template: number,
    level: number
  ): BattleUnitCharacteristics {
    const unitsMeta = game.battleManager.meta.units;
    const unitMeta = _.cloneDeep(unitsMeta[template]) || {};
    const classMeta =
      _.cloneDeep(game.battleManager.meta.classes[unitMeta.class]) || {};

    const v = {
      Level: level,

      ClassHp: classMeta.hp || 0,
      ClassDamage: classMeta.damage || 0,
      ClassDefense: classMeta.defence || 0,
      ClassSpeed: classMeta.speed || 0,

      MultiplierHp: unitMeta.multiplierHp || 0,
      MultiplierDamage: unitMeta.multiplierDamage || 0,
      MultiplierDefence: unitMeta.multiplierDefence || 0,
      MultiplierSpeed: unitMeta.multiplierSpeed || 0,
      MultiplierInitiative: unitMeta.multiplierInitiative || 0,

      LevelStepHp: unitMeta.levelStepHp || 0,
      LevelStepDamage: unitMeta.levelStepDamage || 0,
    };

    // HP: ClassHp*((MultiplierHp+LevelStepHp*(Level-1))
    const hp = v.ClassHp * (v.MultiplierHp + v.LevelStepHp * (v.Level - 1));

    // Damage: ClassDamage*((MultiplierDamage+LevelStepDamage*(Level-1))
    const damage =
      v.ClassDamage * (v.MultiplierDamage + v.LevelStepDamage * (v.Level - 1));

    // Defense: ClassDefense*MultiplierDefence^(Level-1)
    const defence = Math.pow(v.ClassDefense * v.MultiplierDefence, v.Level - 1);

    // Speed: ClassSpeed+MultiplierSpeed*(Level-1)
    const speed = v.ClassSpeed + v.MultiplierSpeed * (v.Level - 1);

    // Initiative: Speed * MultiplierInitiative
    const initiative = speed * v.MultiplierInitiative;

    return {
      hp: Math.round(hp),
      damage: Math.round(damage),
      defence: Math.round(defence),
      speed: Math.round(speed),
      initiative: Math.round(initiative),
    };
  }

  protected setCharacteristics(): void {
    this._characteristics = Unit.getCharacteristics(
      this._template,
      this._levelInt
    );
  }

  public maximize() {
    this._tier = 3;
    this._levelInt = SETTINGS.maxUnitTierLevel[this._tier];
    this._level.current = SETTINGS.maxUnitTierLevel[this._tier];
    this._level.next = null;
    this._expirience.value = Unit.getExpForLevel(SETTINGS.maxUnitTierLevel[3]);
    this._expirience.currentLevelExp = 0;
    this._expirience.nextLevelExp = 0;

    this.abilities.maximize();
    this.abilities.update();
    this.setPower();
  }

  public canUpgradeLevel(): boolean {
    return !!this._level.next;
  }

  public commit(): void {
    this.abilities.update();
    this.setPower();
  }

  public static getExpForLevel(level: number): number {
    let i = 0;
    let exp = 0;
    while (i < level) {
      exp += i * 100;
      i++;
    }
    return exp;
  }

  public getValueByFormula(formula: string) {
    return {
      "speed-1": this._characteristics.speed - 1,
      speed: this._characteristics.speed,
      "speed+1": this._characteristics.speed + 1,
      "speed+2": this._characteristics.speed + 2,
      "speed+3": this._characteristics.speed + 3,
    }[formula];
  }
}
