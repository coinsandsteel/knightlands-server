import _ from "lodash";
import errors from "../../../knightlands-shared/errors";
import { COMMODITY_COINS } from "../../../knightlands-shared/battle";
import { BattleCore } from "./BattleCore";
import { BattleUnit } from "../types";
import { Unit } from "../units/Unit";
import { BattleService } from "./BattleService";
import game from "../../../game";
import { BattleUnitMeta } from "../units/MetaDB";

export class BattleInventory extends BattleService {
  protected _core: BattleCore;

  protected _state: BattleUnit[];
  protected _units: Unit[];

  constructor(state: BattleUnit[], core: BattleCore) {
    super();
    this._state = state || [];
    this._core = core;
  }

  get unitIds(): string[] {
    return this._units.map((unit) => unit.unitId);
  }

  public async load() {
    console.log('Inventory load');
    this.createUnits();
  }

  protected createUnits(): void {
    this._units = [];
    this._state.forEach((unit: BattleUnit) => {
      console.log('Inventory create unit', { unitId: unit.unitId, template: unit.template });
      this._units.push(this.makeUnit(unit));
    });
  }

  protected makeUnit(unit: BattleUnit): Unit {
    return new Unit(unit, this._core.events);
  }

  getState(): BattleUnit[] {
    return this._state;
  }

  public getRandomUnit(): Unit {
    // Get random unit blueprint
    const unitBlueprint = _.cloneDeep(
      _.sample(game.battleManager.meta.units)
    ) as BattleUnitMeta;
    // Construct unit
    return Unit.createUnit(unitBlueprint, this._core.events);
  }

  public getNewUnitRandom(): Unit {
    const units = game.battleManager.meta.units;
    const unitEntry = _.sample(units) as BattleUnitMeta;
    const unitMeta = game.battleManager.loadUnitMeta(unitEntry._id);
    return Unit.createUnit(unitMeta, this._core.events);
  }

  public getNewUnitByPropsRandom(params: {
    tribe?: string;
    class?: string;
    tier?: number;
  }): Unit {
    const units = game.battleManager.meta.units;
    const filteredUnits = _.cloneDeep(_.filter(units, params));
    const unitEntry = _.sample(filteredUnits) as BattleUnitMeta;
    const unitMeta = game.battleManager.loadUnitMeta(unitEntry._id);
    return Unit.createUnit(unitMeta, this._core.events);
  }

  public getNewUnit(template: number): Unit {
    const unitBlueprint = game.battleManager.loadUnitMeta(template);
    return Unit.createUnit(unitBlueprint, this._core.events);
  }

  public addUnit(unit: Unit): Unit {
    this.log("Add unit", {
      unitId: unit.unitId,
      template: unit.template,
      tier: unit.tier,
    });

    // Search by template
    const index = this._units.findIndex(
      (entry) => entry.template === unit.template
    );

    // Add or increase quantity
    if (index === -1) {
      this._units.push(unit);
      this._state.push(unit.serialize());
      this._core.events.addUnit(unit);
      this.log("Unit added", unit.unitId);
      return unit;
    } else {
      this._units[index].updateQuantity(unit.quantity);
      this.updateUnitState(this._units[index]);
      this.log("Unit stacked", unit.unitId);
      return this._units[index];
    }
  }

  public setUnits(units: Unit[]) {
    this._units = units;
    this._state = this._units.map((unit) => unit.serialize());
    this._core.events.inventory(units);
  }

  public addExp(unitId: string, value: number) {
    const unit = this.getUnit(unitId);
    unit.addExpirience(value);
    this.updateUnitState(unit);
  }

  protected updateUnitState(unit: Unit): void {
    const stateIndex = this._state.findIndex(
      (entry) => entry.template === unit.template
    );
    const unitIndex = this._units.findIndex(
      (entry) => entry.template === unit.template
    );
    this._state[stateIndex] = this._units[unitIndex].serialize();
    this._core.events.updateUnit(unit);
  }

  public getUnit(unitId: string): Unit | null {
    return (
      this._units.find((inventoryUnit: Unit) => {
        return inventoryUnit.unitId === unitId;
      }) || null
    );
  }

  public getUnitByTemplate(template: number): Unit | null {
    console.log('[getUnitByFilter]', template, _.find(this._units, { template }));
    return _.find(this._units, { template }) || null;
  }

  public upgradeUnitLevel(unitId: string): void {
    const unit = this.getUnit(unitId);
    if (!unit || !unit.canUpgradeLevel()) {
      throw Error("Cannot upgrade a unit");
    }

    if (this._core.user.coins < unit.level.price) {
      throw errors.NotEnoughCurrency;
    }

    this._core.user.debitCurrency(COMMODITY_COINS, unit.level.price);
    unit.upgradeLevel();
    this.updateUnitState(unit);

    if (
      !this._core.game.combatStarted &&
      this._core.game.userSquad.includesUnit(unit.unitId)
    ) {
      this._core.game.proxyUnit(unit.unitId);
    }
  }

  public upgradeUnitAbility(unitId: string, ability: string): void {
    const unit = this.getUnit(unitId);
    if (!unit || !unit.abilities.canUpgradeAbility(ability)) {
      throw Error("Cannot upgrade a unit's ability");
    }

    if (this._core.user.crystals < unit.level.price) {
      throw errors.NotEnoughCurrency;
    }

    this._core.user.debitCurrency(COMMODITY_COINS, unit.level.price);
    unit.abilities.upgradeAbility(ability);
    unit.setPower();
    this.updateUnitState(unit);

    if (
      !this._core.game.combatStarted &&
      this._core.game.userSquad.includesUnit(unit.unitId)
    ) {
      this._core.game.proxyUnit(unit.unitId);
    }
  }
}
