import _ from "lodash";
import {
  BattleEnemySquadDifficultyMeta,
  BattleFighter,
  BattleInitiativeRatingEntry,
  BattleSquadState,
} from "../types";
import { BattleCore } from "./BattleCore";
import { Unit } from "../units/Unit";
import { ENEMY_SQUAD_META, SQUAD_BONUSES } from "../meta";
import { BattleService } from "./BattleService";
import { Fighter } from "../units/Fighter";

export class BattleSquad extends BattleService {
  protected _state: BattleSquadState;
  protected _core: BattleCore;

  protected _isEnemy: boolean;
  protected _fighters: (Fighter | null)[];

  get fighters(): Fighter[] {
    return this._fighters.filter((u) => u);
  }

  get liveFighters(): Fighter[] {
    return this._fighters.filter((u) => u).filter((unit) => !unit.isDead);
  }

  constructor(fighters: BattleFighter[], isEnemy: boolean, core: BattleCore) {
    super();

    this._core = core;
    this._isEnemy = isEnemy;

    this._state = this.getInitialState();
    this._state.fighters = fighters;
  }

  public setFighters(fighters: Fighter[]) {
    this._fighters = fighters;
    this.updateStat();
  }

  public load() {
    this.deserializeFighters();
    this.updateStat();
  }

  public getInitialState(): BattleSquadState {
    return {
      power: 0,
      bonuses: [],
      fighters: [],
    } as BattleSquadState;
  }

  public getState(): BattleSquadState {
    this.serializeFighters();
    return this._state;
  }

  public getBalancedEnemySquad(userSquad: BattleSquad, difficulty: string): Fighter[] {
    const meta = ENEMY_SQUAD_META[difficulty] as BattleEnemySquadDifficultyMeta;
    if (!meta) {
      throw new Error('No such difficulty!');
    }

    // Levels mean value
    const userSquadLevelMean = userSquad.fighters.reduce((value: number, fighter: Fighter) => value + fighter.unit.levelInt, 0) / 5;
    const userSquadAbilitiesTier1Mean = userSquad.fighters.reduce((value: number, fighter: Fighter) => value + fighter.unit.abilities.getAbilityLevelByTier(1), 0) / 5;
    const userSquadAbilitiesTier2Mean = userSquad.fighters.reduce((value: number, fighter: Fighter) => value + fighter.unit.abilities.getAbilityLevelByTier(2), 0) / 5;
    const userSquadAbilitiesTier3Mean = userSquad.fighters.reduce((value: number, fighter: Fighter) => value + fighter.unit.abilities.getAbilityLevelByTier(3), 0) / 5;

    // Collect by classes count
    const fighters = [];
    const allClasses = Object.keys(meta.classes);
    while (fighters.length < 5) {
      let choosedClass = _.sample(allClasses);
      let classQuantity = meta.classes[choosedClass];
      let fightersCount = _.random(classQuantity.min, classQuantity.max);
      if (fightersCount > 0) {
        for (let i = 0; i < fightersCount; i++) {
          if (fighters.length >= 5) {
            break;
          }

          // Get unit 1 tier
          const unit = this._core.inventory.getNewUnitByPropsRandom({
            class: choosedClass,
            tier: 1
          });

          // Unit levels
          const unitLevelModifier = meta.unitLevelModifier.min + Math.random();
          const unitLevel = Math.round(userSquadLevelMean * unitLevelModifier);
          unit.setLevel(unitLevel, false, true);

          // Ability levels
          unit.setAbilitiesLevels([
            { tier: 1, level: Math.round(userSquadAbilitiesTier1Mean + meta.abilityLevelModifier) },
            { tier: 2, level: Math.round(userSquadAbilitiesTier2Mean + meta.abilityLevelModifier) },
            { tier: 3, level: Math.round(userSquadAbilitiesTier3Mean + meta.abilityLevelModifier) },
          ]);

          console.log({
            userSquadLevelMean,
            unitLevel: userSquadLevelMean * unitLevelModifier,
            userSquadAbilitiesTier1Mean,
            userSquadAbilitiesTier2Mean,
            userSquadAbilitiesTier3Mean,
          });

          const fighter = Fighter.createFighterFromUnit(unit, true, this._core.events);
          fighters.push(fighter);
        }
      }
    }

    return fighters;
  }

  protected deserializeFighters(): void {
    this._fighters = [];
    if (this._state && this._state.fighters) {
      this._state.fighters.forEach((blueprint: BattleFighter | null) => {
        this._fighters.push(blueprint ? new Fighter(blueprint, this._core.events) : null);
      });
    }
  }

  public serializeFighters(): void {
    this._state.fighters = [];
    if (this._fighters) {
      this._fighters.forEach((fighter: Fighter | null, index: number) => {
        this._state.fighters[index] = fighter
          ? fighter.serialize()
          : null;
      });
    }
  }

  protected makeFighter(blueprint: BattleFighter): Fighter {
    const isEnemy = blueprint.isEnemy || this._isEnemy;

    /*console.log(`Make fighter`, {
      isEnemySquad: this._isEnemy,
      isEnemy: blueprint.isEnemy,
      fighterUnitId: blueprint.unitId,
      fighterTemplate: blueprint.unitTemplate,
    });*/

    const unit = isEnemy
      ? this._core.inventory.getNewUnit(blueprint.unitTemplate)
      : _.cloneDeep(
          this._core.inventory.getUnitByTemplate(blueprint.unitTemplate)
        );

    if (!unit) {
      throw new Error(
        `[makeFighter] Unit @${blueprint.unitTemplate} not found in the inventory`
      );
    }

    if (blueprint.isBoss) {
      unit.turnIntoBoss();
    }

    blueprint.isEnemy = this._isEnemy;
    return new Fighter(blueprint, this._core.events);
  }

  public fillSlot(unitId: string, index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw Error("Cannot fill this slot - no such a slot");
    }

    const unit = _.cloneDeep(this._core.inventory.getUnit(unitId) as Unit);
    if (!unit) {
      throw new Error(`[fillSlot] Unit #${unitId} not found in the inventory`);
    }

    if (this.getFighterByTemplate(unit.template)) {
      return;
    }

    const figher = Fighter.createFighterFromUnit(
      unit,
      this._isEnemy,
      this._core.events
    );

    // Fill slot
    this._fighters[index] = figher;
    this.updateStat();

    // Event
    this.sync();

    this.log(`Unit ${unitId} was set into slot #${index}`);
  }

  public clearSlot(index: number): void {
    if (!(index >= 0 && index <= 4)) {
      throw Error("Cannot clear this slot - no such a slot");
    }

    // Fill slot
    this._fighters[index] = null;

    this.updateStat();

    // Event
    this.sync();
  }

  public proxyUnit(unitId: string): void {
    for (let index = 0; index < 5; index++) {
      if (this._fighters[index] && this._fighters[index].unit.unitId === unitId) {
        this.fillSlot(unitId, index);
      }
    }

    this.sync();
  }

  public sync(): void {
    this.serializeFighters();
    this._core.events.userSquad(this._state);
  }

  public setInitiativeRating(rating: BattleInitiativeRatingEntry[]) {
    this.fighters.forEach((fighter) => {
      const ratingIndex = _.findIndex(rating, { fighterId: fighter.fighterId });
      if (ratingIndex !== -1) {
        fighter.setRatingIndex(ratingIndex + 1);
      }
    });
  }

  protected setBonuses(): void {
    if (!this.fighters.length) {
      return;
    }

    let stat = {};

    this.fighters.forEach((fighter) => {
      stat = {
        ...stat,
        [fighter.unit.tribe]: {
          ...stat[fighter.unit.tribe],
          ...{
            [fighter.unit.tier]:
              _.get(stat, `${fighter.unit.tribe}.${fighter.unit.tier}`, 0) + 1,
          },
        },
      };
    });

    let bonuses = [];
    _.forOwn(stat, (tribeStat, fighterTribe) => {
      _.forOwn(tribeStat, (tierCount, fighterTier) => {
        if (tierCount >= 2) {
          bonuses.push(
            SQUAD_BONUSES[fighterTribe][parseInt(fighterTier) - 1][tierCount - 2]
          );
        }
      });
    });

    // Apply bonuses
    this.fighters.forEach((fighter) => {
      fighter.buffs.reset();
      bonuses.forEach((bonus) =>
        fighter.buffs.addBuff({ source: "squad", ...bonus }, false)
      );
    });

    this._state.bonuses = bonuses;
    // this.log("Squad bonuses", { bonuses });
  }

  public setPower(): void {
    if (!this.fighters.length) {
      this._state.power = 0;
      return;
    }

    this._state.power = _.sumBy(this.fighters, "power");
  }

  public includesUnit(unitId: string): boolean {
    return (
      this.fighters.findIndex((fighters) => fighters.unit.unitId === unitId) !== -1
    );
  }

  public updateStat(): void {
    this.setBonuses();
    this.setPower();
  }

  public prepare(): void {
    this.fighters.forEach((fighter, index) => {
      // Reset fighter state
      fighter.reset();
      // Reset index
      fighter.setIndex(index + (this._isEnemy ? 0 : 30));
    });
  }

  public addExp(expValue: number): void {
    this.fighters.forEach((fighter, index) => {
      this._core.inventory.addExp(fighter.unit.template, expValue);
    });
  }

  public getFighter(fighterId: string): Fighter | null {
    return (
      this.fighters.find((fighter) => fighter.fighterId === fighterId) || null
    );
  }

  public getFighterByTemplate(template: number): Fighter | null {
    return (
      this.fighters.find((fighter) => fighter.unit.template === template) || null
    );
  }

  public callbackDrawFinished(): void {
    this.fighters.forEach((fighter) => {
      // Decrease the cooldown
      fighter.abilities.decreaseAbilitiesCooldownEstimate();
      // Decrease the buff estimate
      fighter.buffs.decreaseBuffsEstimate();
    });
  }

  public setTier(tier: number): void {
    this.fighters.forEach((fighter) => fighter.unit.setTier(tier));
    this.setPower();
    this.sync();
  }

  public maximize(): void {
    this.fighters.forEach((fighter) => fighter.unit.maximize());
    this.setPower();
    this.sync();
  }
}
