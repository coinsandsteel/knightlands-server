import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { BattleEvents } from "../services/BattleEvents";
import { BattleFighter } from "../types";
import FighterBuffs from "./FighterBuffs";
import { Unit } from "./Unit";
import UnitAbilities from "./UnitAbilities";

export class Fighter {
  protected _events: BattleEvents;
  protected readonly _unit: Unit;

  protected _unitId: string;
  protected _unitTemplate: number;
  protected _fighterId: string;
  protected _isEnemy: boolean;
  protected _isDead: boolean;
  protected _ratingIndex: number;
  protected _isStunned: boolean;
  protected _index: number | null;
  protected _hp: number;
  protected _buffs: FighterBuffs;

  public _modifiers: {
    speed: number;
    initiative: number;
    defence: number;
    power: number;
    attack: number;
    abilities: number;
  };

  get abilities(): UnitAbilities {
    return this._unit.abilities;
  }

  get unit(): Unit {
    return this._unit;
  }

  get buffs(): FighterBuffs {
    return this._buffs;
  }

  get index(): number {
    return this._index;
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

  get hp(): number {
    return this._hp;
  }

  get isStunned(): boolean {
    return this._isStunned;
  }

  get speed(): number {
    const bonusDelta = this.buffs.getBonusDelta("speed");
    return (
      Math.round(this.unit.characteristics.speed * this._modifiers.speed) +
      bonusDelta
    );
  }

  get initiative(): number {
    const bonusDelta = this.buffs.getBonusDelta("initiative");
    return (
      Math.round(
        this.unit.characteristics.initiative * this._modifiers.initiative
      ) + bonusDelta
    );
  }

  get defence(): number {
    const bonusDelta = this.buffs.getBonusDelta("defence");
    return (
      Math.round(this.unit.characteristics.defence * this._modifiers.defence) +
      bonusDelta
    );
  }

  get damage(): number {
    const bonusDelta = this.buffs.getBonusDelta("damage");
    return (
      Math.round(
        this.unit.characteristics.damage *
          this._modifiers.power *
          this._modifiers.attack
      ) + bonusDelta
    );
  }

  get hasAgro(): boolean {
    return !!this.buffs.getBuffs({ type: "agro" }).length;
  }

  get agroTargets(): string[] {
    return this.buffs
      .getBuffs({ type: "agro" })
      .map((buff) => buff.targetFighterId);
  }

  get launchToCounterAttack(): boolean {
    return (
      !this.isStunned &&
      this.buffs
        .getBuffs({ type: "counter_attack" })
        .some((buff) => Math.random() <= buff.probability)
    );
  }

  constructor(unit: Unit, blueprint: BattleFighter, events: BattleEvents) {
    if (!unit) {
      throw new Error(`Unit #${blueprint.unitId} not found in the inventory`);
    }

    this._modifiers = {
      speed: -1,
      initiative: -1,
      defence: -1,
      power: -1,
      attack: -1,
      abilities: -1,
    };

    this._unitId = unit.unitId;
    this._unitTemplate = unit.template;
    this._fighterId = blueprint.fighterId;
    this._isEnemy = blueprint.isEnemy;
    this._isDead = blueprint.isDead;
    this._ratingIndex = blueprint.ratingIndex;
    this._isStunned = blueprint.isStunned;
    this._index = blueprint.index;
    this._hp = blueprint.hp;

    this._unit = unit;
    this._buffs = new FighterBuffs(events, this, blueprint.buffs);
    this._events = events;

    this.update();
  }

  public static createFighter(unit: Unit, isEnemy: boolean, events: BattleEvents): Fighter {
    const blueprint = {
      unitId: unit.unitId,
      unitTemplate: unit.template,
      fighterId: uuidv4().split("-").pop(),
      isEnemy,
      isDead: false,
      ratingIndex: 0,
      isStunned: false,
      index: null,
      hp: unit.maxHp,
      buffs: []
    } as BattleFighter;
    return new Fighter(unit, blueprint, events);
  }

  public reset(): void {
    this._modifiers = {
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
    this._hp = this.unit.maxHp;

    this.buffs.reset();
    this.abilities.reset();

    this.update(true);
  }

  public regenerateFighterId(): void {
    this._fighterId = uuidv4().split("-").pop();
  }

  public attackCallback() {
    this.buffs.handleDamageCallback();
  }

  public serializeFighter(): BattleFighter {
    const fighter = {
      unitId: this._unitId,
      unitTemplate: this._unitTemplate,
      fighterId: this._fighterId,
      isEnemy: this._isEnemy,
      isDead: this._isDead,
      ratingIndex: this._ratingIndex,
      isStunned: this._isStunned,
      index: this._index,
      hp: this._hp,
      buffs: this.buffs.serialize(),
    } as BattleFighter;
    return _.cloneDeep(fighter);
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
    } else if (this._hp > this.unit.maxHp) {
      this._hp = this.unit.maxHp;
    }
  }

  public setRatingIndex(value: number) {
    this._ratingIndex = value;
  }

  public update(initial?: boolean): void {
    this.buffs.update(initial);

    // Characteristics
    this._modifiers.defence = this.buffs.getBuffModifier({ type: "defence" });
    this._modifiers.speed = this.buffs.getBuffModifier({ type: "speed" });
    this._modifiers.initiative = this.buffs.getBuffModifier({
      type: "initiative",
    });

    // Attack bonuses
    this._modifiers.power = this.buffs.getBuffModifier({ type: "power" });
    this._modifiers.attack = this.buffs.getBuffModifier({ type: "attack" });
    this._modifiers.abilities = this.buffs.getBuffModifier({
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
    this.unit.setPower();
  }

  public setStunned(value: boolean) {
    this._isStunned = value;
  }
}
