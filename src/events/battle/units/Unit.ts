import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { BattleEvents } from "../services/BattleEvents";
import { SETTINGS, UNIT_LEVEL_UP_PRICES } from "../meta";
import {
  BattleBuff,
  BattleLevelScheme,
  BattleUnit,
  BattleUnitCharacteristics,
} from "../types";
import game from "../../../game";
import UnitAbilities from "./UnitAbilities";
import UnitBuffs from "./UnitBuffs";

export class Unit {
  public abilities: UnitAbilities;
  public buffs: UnitBuffs;
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
  protected _quantity: number;

  // Combat
  protected _info: any;
  protected _ratingIndex: number;
  protected _isStunned: boolean;
  protected _hp: number;
  protected _index: number | null;
  protected _buffs: BattleBuff[] = [];

  public modifiers: {
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

  get levelInt(): number {
    return this._levelInt;
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
    const bonusDelta = this.buffs.getBonusDelta("speed");
    this._info["speed"] = {
      base: this._characteristics.speed,
      modifier: this.modifiers.speed,
      delta: bonusDelta,
    };
    return (
      Math.round(this._characteristics.speed * this.modifiers.speed) +
      bonusDelta
    );
  }

  get initiative(): number {
    const bonusDelta = this.buffs.getBonusDelta("initiative");
    this._info["initiative"] = {
      base: this._characteristics.initiative,
      modifier: this.modifiers.initiative,
      delta: bonusDelta,
    };
    return (
      Math.round(this._characteristics.initiative * this.modifiers.initiative) +
      bonusDelta
    );
  }

  get defence(): number {
    const bonusDelta = this.buffs.getBonusDelta("defence");
    this._info["defence"] = {
      base: this._characteristics.defence,
      modifier: this.modifiers.defence,
      delta: bonusDelta,
    };
    return (
      Math.round(this._characteristics.defence * this.modifiers.defence) +
      bonusDelta
    );
  }

  get damage(): number {
    const bonusDelta = this.buffs.getBonusDelta("damage");
    this._info["damage"] = {
      base: this._characteristics.damage,
      power: this.modifiers.power,
      attack: this.modifiers.attack,
      delta: bonusDelta,
    };
    return (
      Math.round(
        this._characteristics.damage *
          this.modifiers.power *
          this.modifiers.attack
      ) + bonusDelta
    );
  }

  get isStunned(): boolean {
    return this._isStunned;
  }

  get hasAgro(): boolean {
    return !!this.buffs.getBuffs({ type: "agro" }).length;
  }

  get agroTargets(): string[] {
    return this.buffs
      .getBuffs({ type: "agro" })
      .map((buff) => buff.targetFighterId);
  }

  get wantToCounterAttack(): boolean {
    return (
      !this.isStunned &&
      this.buffs
        .getBuffs({ type: "counter_attack" })
        .some((buff) => Math.random() <= buff.probability)
    );
  }

  constructor(blueprint: BattleUnit, events: BattleEvents) {
    //console.log('Make unit', blueprint);

    this._info = {};
    this._events = events;

    this.modifiers = {
      speed: -1,
      initiative: -1,
      defence: -1,
      power: -1,
      attack: -1,
      abilities: -1,
    };

    this._template = blueprint.template;
    this._unitId = blueprint.unitId || uuidv4().split("-").pop();
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
    } else {
      this._isDead = false;
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
        price: null,
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
        nextLevelExp: this.getExpForLevel(2),
      };
    }

    if ("characteristics" in blueprint) {
      this._characteristics = blueprint.characteristics;
    } else {
      this._characteristics = Unit.getCharacteristics(
        this._template,
        this._levelInt
      );
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

    this.abilities = new UnitAbilities(this, blueprint.abilities);
    this.buffs = new UnitBuffs(this._events, this, blueprint.buffs as any[]);

    //this.log(`Init (need commit)`);
    this.commit();
  }

  public reset(): void {
    //this.log(`Reset started (need commit)`);

    this.modifiers = {
      speed: -1,
      initiative: -1,
      defence: -1,
      power: -1,
      attack: -1,
      abilities: -1,
    };

    this._ratingIndex = null;
    this._isStunned = false;
    this._isDead = false;
    this._index = null;
    this._hp = this.maxHp;

    this.abilities.reset();
    this.buffs.reset();

    this.commit(true);

    //this.log(`Reset finished`, this.variables);
  }

  public regenerateFighterId(): void {
    this._fighterId = uuidv4().split("-").pop();
  }

  public attackCallback() {
    this.buffs.handleDamageCallback();
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
      template: this._template,
      unitId: this._unitId,
      unitTribe: this._unitTribe,
      unitClass: this._unitClass,
      tier: this._tier,
      level: this._level,
      power: this._power,
      expirience: this._expirience,
      characteristics: this._characteristics,
      abilities: this.abilities.serialize(),
      quantity: this._quantity,
    } as BattleUnit;

    return _.cloneDeep(unit);
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
      abilities: this.abilities.serialize(),
      buffs: this.buffs.serialize(),
      info: this._info,
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

    this.abilities.unlock();
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
    this._expirience.value = this.getExpForLevel(SETTINGS.maxUnitTierLevel[3]);
    this._expirience.currentLevelExp = 0;
    this._expirience.nextLevelExp = 0;

    this.abilities.maximize();
    this.abilities.update();
    this.setPower();
  }

  public canUpgradeLevel(): boolean {
    return !!this._level.next;
  }

  public setIndex(index: number): void {
    if (index < 0 || index > 34) {
      throw Error("[Unit] Unit index overflow");
    }
    this._index = index;
  }

  public modifyHp(value: number, force?: boolean): void {
    if (this._isDead) {
      return;
    }

    if (!force) {
      this._hp += value;
    } else {
      this._hp = value;
    }

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
  }

  public setRatingIndex(value: number) {
    this._ratingIndex = value;
  }

  public commit(initial?: boolean): void {
    //this.log(`Commit start`, this.variables);

    this.buffs.calc(initial);

    // Characteristics
    this.modifiers.defence = this.buffs.getBuffModifier({ type: "defence" });
    this.modifiers.speed = this.buffs.getBuffModifier({ type: "speed" });
    this.modifiers.initiative = this.buffs.getBuffModifier({
      type: "initiative",
    });

    // Attack bonuses
    this.modifiers.power = this.buffs.getBuffModifier({ type: "power" });
    this.modifiers.attack = this.buffs.getBuffModifier({ type: "attack" });
    this.modifiers.abilities = this.buffs.getBuffModifier({
      type: "abilities",
    });

    // Stun
    const stunBuffs = this.buffs.getBuffs({ type: "stun" });
    if (stunBuffs.length) {
      this._isStunned = stunBuffs.some(
        (buff) => Math.random() <= buff.probability
      );
    } else {
      this._isStunned = false;
    }

    this.abilities.update();
    this.setPower();

    //this.log(`Commit finish`, this.variables);
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

  public getValueByFormula(formula: string) {
    return {
      "speed-1": this._characteristics.speed - 1,
      speed: this._characteristics.speed,
      "speed+1": this._characteristics.speed + 1,
      "speed+2": this._characteristics.speed + 2,
      "speed+3": this._characteristics.speed + 3,
    }[formula];
  }

  protected log(message: string, payload?: any) {
    //console.log(`[Unit id=${this._unitId} fighterId=${this._fighterId}] ${message}`, payload);
  }
}
