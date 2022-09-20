import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { BattleEvents } from "../services/BattleEvents";
import { BattleFighter } from "../types";
import FighterBuffs from "./FighterBuffs";
import { Unit } from "./Unit";

export class Fighter extends Unit {
  protected _unit: Unit;

  protected _unitId: string;
  protected _fighterId: string;
  protected _isEnemy: boolean;
  protected _isDead: boolean;
  protected _ratingIndex: number;
  protected _isStunned: boolean;
  protected _index: number | null;
  protected _hp: number;
  public buffs: FighterBuffs;

  public _modifiers: {
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

  get speed(): number {
    const bonusDelta = this.buffs.getBonusDelta("speed");
    return (
      Math.round(this._characteristics.speed * this._modifiers.speed) +
      bonusDelta
    );
  }

  get initiative(): number {
    const bonusDelta = this.buffs.getBonusDelta("initiative");
    return (
      Math.round(
        this._characteristics.initiative * this._modifiers.initiative
      ) + bonusDelta
    );
  }

  get defence(): number {
    const bonusDelta = this.buffs.getBonusDelta("defence");
    return (
      Math.round(this._characteristics.defence * this._modifiers.defence) +
      bonusDelta
    );
  }

  get damage(): number {
    const bonusDelta = this.buffs.getBonusDelta("damage");
    return (
      Math.round(
        this._characteristics.damage *
          this._modifiers.power *
          this._modifiers.attack
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

  constructor(unit: Unit, blueprint: BattleFighter, events: BattleEvents) {
    super(unit.serialize(), events);

    this._modifiers = {
      speed: -1,
      initiative: -1,
      defence: -1,
      power: -1,
      attack: -1,
      abilities: -1,
    };

    this._unitId = unit.unitId;
    this._fighterId = blueprint.fighterId;
    this._isEnemy = blueprint.isEnemy;
    this._isDead = blueprint.isDead;
    this._ratingIndex = blueprint.ratingIndex;
    this._isStunned = blueprint.isStunned;
    this._index = blueprint.index;
    this._hp = blueprint.hp;

    this.buffs = new FighterBuffs(events, this, blueprint.buffs);
    this._events = events;

    this.commit();
  }

  public static createFighter(unit: Unit, isEnemy: boolean, events: BattleEvents): Fighter {
    const blueprint = {
      unitId: unit.unitId,
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
    this._hp = this.maxHp;

    this.abilities.reset();
    this.buffs.reset();

    this.commit(true);
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
    } else if (this._hp > this.maxHp) {
      this._hp = this.maxHp;
    }
  }

  public setRatingIndex(value: number) {
    this._ratingIndex = value;
  }

  public commit(initial?: boolean): void {
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
    this.setPower();
  }

  public setStunned(value: boolean) {
    this._isStunned = value;
  }
}
