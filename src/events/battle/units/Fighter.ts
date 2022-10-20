import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { BattleEvents } from "../services/BattleEvents";
import { BattleFighter, BattleUnit, BattleUnitCharacteristics } from "../types";
import FighterBuffs from "./FighterBuffs";
import { Unit } from "./Unit";
import UnitAbilities from "./UnitAbilities";

export class Fighter {
  protected _events: BattleEvents;
  protected readonly _unit: Unit; // Unit copy

  protected _fighterId: string;
  protected _isBoss: boolean;
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

  get isBoss(): boolean {
    return this._isBoss;
  }

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

  get hp(): number {
    return this._hp;
  }

  get isStunned(): boolean {
    return this._isStunned;
  }

  get characteristics(): BattleUnitCharacteristics {
    return {
      hp: this._unit.maxHp,
      speed: this.speed,
      initiative: this.initiative,
      defence: this.defence,
      damage: this.damage,
    };
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
        this.unit.damage *
          this._modifiers.power *
          this._modifiers.attack
      ) + bonusDelta
    );
  }

  get hasAgro(): boolean {
    return !!this.buffs.getBuffs({ subEffect: "agro" }).length;
  }

  get agroTargets(): string[] {
    return this.buffs
      .getBuffs({ subEffect: "agro" })
      .map((buff) => buff.targetFighterId);
  }

  get launchCounterAttack(): boolean {
    return (
      !this.isStunned &&
      this.buffs
        .getBuffs({ subEffect: "counter_attack" })
        .some((buff) => Math.random() <= buff.probability)
    );
  }

  constructor(blueprint: BattleFighter, events: BattleEvents) {
    this._unit = new Unit(blueprint.unit, events);
    this._events = events;

    this._modifiers = {
      speed: -1,
      initiative: -1,
      defence: -1,
      power: -1,
      attack: -1,
      abilities: -1,
    };

    this._fighterId = blueprint.fighterId;
    this._isBoss = blueprint.isBoss;
    this._isEnemy = blueprint.isEnemy;
    this._isDead = blueprint.isDead;
    this._ratingIndex = blueprint.ratingIndex;
    this._isStunned = blueprint.isStunned;
    this._index = blueprint.index;
    this._hp = blueprint.hp;
    this._buffs = new FighterBuffs(events, this, blueprint.buffs);

    this.update();
  }

  public static createFighterFromUnit(
    unit: Unit,
    isEnemy: boolean,
    events: BattleEvents
  ): Fighter {
    const blueprint = {
      unit: unit.serialize(),
      fighterId: uuidv4().split("-").pop(),
      isEnemy,
      isDead: false,
      ratingIndex: 0,
      isStunned: false,
      index: null,
      hp: unit.maxHp,
      buffs: [],
      abilities: unit.abilities.serialize(),
    } as BattleFighter;
    return new Fighter(blueprint, events);
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

  public serialize(): BattleFighter {
    const fighter = {
      unit: this.unit.serialize(),
      fighterId: this._fighterId,
      isEnemy: this._isEnemy,
      isDead: this._isDead,
      ratingIndex: this._ratingIndex,
      isStunned: this._isStunned,
      index: this._index,
      hp: this._hp,
      buffs: this.buffs.serialize(),
      characteristics: this.characteristics
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
        this._events.enemyFighter(this.serialize());
      } else {
        this._events.userFighter(this.serialize());
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
    this._modifiers.defence = this.buffs.getBuffModifier({ target: "defence" });
    this._modifiers.speed = this.buffs.getBuffModifier({ target: "speed" });
    this._modifiers.initiative = this.buffs.getBuffModifier({
      target: "initiative",
    });

    // Attack bonuses
    this._modifiers.power = this.buffs.getBuffModifier({ target: "power" });
    this._modifiers.attack = this.buffs.getBuffModifier({ target: "attack" });
    this._modifiers.abilities = this.buffs.getBuffModifier({
      target: "abilities",
    });

    // Stun
    const stunBuffs = this.buffs.getBuffs({ subEffect: "stun" });
    if (stunBuffs.length) {
      this._isStunned = stunBuffs.some(
        (buff) => Math.random() <= buff.probability
      );
    } else {
      this._isStunned = false;
    }

    this.abilities.update({
      speed: this.speed,
      damage: this.damage
    });
  }

  public setStunned(value: boolean) {
    this._isStunned = value;
  }
}
