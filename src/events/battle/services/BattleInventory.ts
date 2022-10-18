import _ from "lodash";
import errors from "../../../knightlands-shared/errors";
import { CURRENCY_COINS, CURRENCY_CRYSTALS } from "../../../knightlands-shared/battle";
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
    //console.log('Inventory load');
    this.createUnits();
  }

  protected createUnits(): void {
    this._units = [];
    this._state.forEach((unit: BattleUnit) => {
      //console.log('Inventory create unit', { unitId: unit.unitId, template: unit.template });
      this._units.push(this.makeUnit(unit));
    });
  }

  protected makeUnit(unit: BattleUnit): Unit {
    return new Unit(unit, this._core.events);
  }

  public getState(): BattleUnit[] {
    return this._state;
  }

  public handleInventoryChanged(): void {
    const totalPower = this._units.reduce(
      (prev: number, current: Unit) => prev + current.power,
      0
    );
    game.battleManager.updateRank(this._core.gameUser.id, 'power', totalPower);
  }

  public merge(template: number): BattleUnit {
    const unit = this.getUnitByTemplate(template);
    if (!unit || unit.quantity < 3 || unit.tier > 2) {
      return;
    }

    const oldUnitMeta = game.battleManager.getUnitMeta(template);
    const newUnitMetaList = game.battleManager.getAllUnitsMetaByParams({
      class: unit.class,
      tribe: unit.tribe,
      tier: unit.tier + 1
    });
    if (!newUnitMetaList.length) {
      throw Error(`Merge failed. No such unit meta (class: ${unit.class}, tribe: ${unit.tribe}, tier: ${unit.tier})`);
    }

    // Find exact match by abilities
    let newUnitMeta = null;
    if (newUnitMetaList.length > 1) {
      newUnitMeta = newUnitMetaList.find(entry => _.intersection(oldUnitMeta.abilityList, entry.abilityList).length === 3);
    } else {
      newUnitMeta = newUnitMetaList[0];
    }
    if (!newUnitMeta) {
      throw Error(`Merge failed. Next tier not found (class: ${unit.class}, tribe: ${unit.tribe}, tier: ${unit.tier})`);
    }

    // Add new unit
    const newUnitEntry = Unit.createUnit(newUnitMeta, this._core.events);
    /*console.log('Merge abilities', {
      source: unit.abilities.abilities,
      target: newUnitEntry.abilities.abilities
    });*/

    // Set the same level
    newUnitEntry.setLevel(unit.levelInt, true);
    //console.log('Merge set level', unit.levelInt);

    // Calc abilities
    newUnitEntry.abilities.abilities.forEach(ability => {
      const sourceUnitAbilityData = unit.abilities.getAbilityByClass(ability.abilityClass);
      if (sourceUnitAbilityData.enabled) {
        //console.log('Merge ability', { abilityClass: ability.abilityClass, levelInt: sourceUnitAbilityData.levelInt });
        newUnitEntry.abilities.setAbilityLevel(
          ability.abilityClass,
          sourceUnitAbilityData.levelInt
        );
      }
    });

    const newUnit = this.addUnit(newUnitEntry);

    // Spend 3 source units
    this.removeUnit(unit, 3);

    return newUnit.serialize();
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
    let resultUnit = unit;
    if (index === -1) {
      this._units.push(unit);
      this._state.push(unit.serialize());
      this._core.events.addUnit(unit);
      this.log("Unit added", unit.unitId);
    } else {
      this._units[index].modifyQuantity(1);
      this.updateUnitState(this._units[index]);
      this.log("Unit stacked", unit.unitId);
      resultUnit = this._units[index];
    }
    this.handleInventoryChanged();

    return resultUnit;
  }

  public removeUnit(unit: Unit, quantity: number): void {
    // Search by template
    const index = this._units.findIndex(
      (entry) => entry.template === unit.template
    );

    if (index !== -1) {
      this._units[index].modifyQuantity(-quantity);

      if (this._units[index].quantity <= 0) {
        delete this._units[index];
        this._units = this._units.filter(e => e);
        this._core.events.removeUnit(unit);

        const squadIndex = this._core.game.userSquad.fighters.findIndex(
          entry => entry.template === unit.template
        );
        if (squadIndex !== -1) {
          this._core.game.userSquad.clearSlot(squadIndex);
        }
      } else {
        this.updateUnitState(this._units[index]);
      }

      this.handleInventoryChanged();
    }
  }

  public setUnits(units: Unit[]) {
    this._units = units;
    this._state = this._units.map((unit) => unit.serialize());
    this._core.events.inventory(units);
    this.handleInventoryChanged();
  }

  public addExp(template: number, value: number) {
    const unit = this.getUnitByTemplate(template);
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
    //console.log('[getUnitByFilter]', template, _.find(this._units, { template }));
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

    this._core.user.modifyBalance(CURRENCY_COINS, -unit.level.price);
    unit.upgradeLevel();
    this.updateUnitState(unit);

    if (
      !this._core.game.combatStarted &&
      this._core.game.userSquad.includesUnit(unit.unitId)
    ) {
      this._core.game.proxyUnit(unit.unitId);
    }

    this.handleInventoryChanged();
  }

  public upgradeUnitAbility(unitId: string, ability: string): void {
    const unit = this.getUnit(unitId);
    if (!unit || !unit.abilities.canUpgradeAbility(ability)) {
      throw Error("Cannot upgrade a unit's ability");
    }

    if (this._core.user.crystals < unit.level.price) {
      throw errors.NotEnoughCurrency;
    }

    this._core.user.modifyBalance(CURRENCY_CRYSTALS, -unit.level.price);
    unit.abilities.upgradeAbility(ability);
    unit.setPower();
    this.updateUnitState(unit);

    if (
      !this._core.game.combatStarted &&
      this._core.game.userSquad.includesUnit(unit.unitId)
    ) {
      this._core.game.proxyUnit(unit.unitId);
    }

    this.handleInventoryChanged();
  }
}
