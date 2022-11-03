import _ from "lodash";
import {
  BattleBuff,
  BattleEnemySquadDifficultyMeta,
  BattleFighter,
  BattleInitiativeRatingEntry,
  BattleSquadState,
} from "../types";
import { BattleCore } from "./BattleCore";
import { Unit } from "../units/Unit";
import { BUFF_SOURCE_SQUAD, ENEMY_SQUAD_META, SQUAD_BONUSES } from "../meta";
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
    this.deserializeFighters();
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

  public getBalancedEnemySquad(
    userSquad: BattleSquad,
    difficulty: string
  ): Fighter[] {
    const meta = ENEMY_SQUAD_META[difficulty] as BattleEnemySquadDifficultyMeta;
    if (!meta) {
      throw new Error("No such difficulty!");
    }
    if (!userSquad.fighters.length) {
      throw new Error("Cannot spawn enemy against an empty squad!");
    }

    // Levels mean value
    const userSquadLevelMean =
      userSquad.fighters.reduce(
        (value: number, fighter: Fighter) => value + fighter.unit.levelInt,
        0
      ) / userSquad.fighters.length;
    const userSquadAbilitiesTier1Mean =
      userSquad.fighters.reduce(
        (value: number, fighter: Fighter) =>
          value + fighter.unit.abilities.getAbilityLevelByTier(1),
        0
      ) / userSquad.fighters.length;
    const userSquadAbilitiesTier2Mean =
      userSquad.fighters.reduce(
        (value: number, fighter: Fighter) =>
          value + fighter.unit.abilities.getAbilityLevelByTier(2),
        0
      ) / userSquad.fighters.length;
    const userSquadAbilitiesTier3Mean =
      userSquad.fighters.reduce(
        (value: number, fighter: Fighter) =>
          value + fighter.unit.abilities.getAbilityLevelByTier(3),
        0
      ) / userSquad.fighters.length;

    const allClasses = Object.keys(meta.classes).sort(() => _.random(-1, 1));
    const classesCount = allClasses.map((unitClass) => ({
      unitClass,
      quantity: meta.classes[unitClass].min,
    }));
    while (_.sumBy(classesCount, "quantity") < 5) {
      const index = _.random(0, classesCount.length - 1);
      if (
        classesCount[index].quantity <
        meta.classes[classesCount[index].unitClass].max
      ) {
        classesCount[index].quantity++;
      }
    }

    // Unit stats
    const unitLevelModifier = meta.unitLevelModifier;
    const unitLevel = Math.max(Math.min(Math.round(userSquadLevelMean + unitLevelModifier), 45), 1);
    const unitTiers = meta.tierModifier.find(entry => unitLevel >= entry.minLevel && unitLevel <= entry.maxLevel).tiers;
    const abilityLevels = [
      Math.round(userSquadAbilitiesTier1Mean + meta.abilityLevelModifier[0]),
      Math.round(userSquadAbilitiesTier2Mean + meta.abilityLevelModifier[1]),
      Math.round(userSquadAbilitiesTier3Mean + meta.abilityLevelModifier[2]),
    ];

    const fighters = [];
    classesCount.forEach((entry) => {
      const classFighters = [];
      while (classFighters.length < entry.quantity) {
        const newFighter = this.getBalancedFighter(
          entry.unitClass,
          _.sample(unitTiers),
          unitLevel,
          abilityLevels
        );
        // Disallow duplicated units
        if (
          fighters.find(
            (entry) => entry.unit.template === newFighter.unit.template
          )
        ) {
          continue;
        }
        classFighters.push(newFighter);
      }
      fighters.push(...classFighters);
    });

    //console.log(`[${difficulty}] Classes`, fighters.map(fighter => fighter.unit.class));

    return fighters;
  }

  protected getBalancedFighter(
    unitClass: string,
    unitTier: number,
    unitLevel: number,
    abilityLevels: number[]
  ): Fighter {
    // Get unit 1 tier
    const unit = this._core.inventory.getNewUnitByPropsRandom({
      class: unitClass,
      tier: unitTier
    });

    // Set level + upgrade tier + set new template
    unit.setLevel(unitLevel, true, true);

    // Set ability levels
    unit.setAbilitiesLevels([
      {
        tier: 1,
        level: abilityLevels[0],
      },
      {
        tier: 2,
        level: abilityLevels[1],
      },
      {
        tier: 3,
        level: abilityLevels[2],
      },
    ]);

    return Fighter.createFighterFromUnit(unit, true, this._core.events);
  }

  protected deserializeFighters(): void {
    //console.log('De-serializing fighters', { fightersState: this._state.fighters });
    this._fighters = [];
    if (this._state && this._state.fighters) {
      this._state.fighters.forEach((blueprint: BattleFighter | null) => {
        this._fighters.push(
          blueprint ? new Fighter(blueprint, this._core.events) : null
        );
      });
    } else {
      //console.log('No fighters to de-serialize');
    }
    //console.log('De-serialized fighters', { fighters: this._fighters });
  }

  public serializeFighters(): void {
    //console.log('Serializing fighters', { fighters: this._fighters });
    this._state.fighters = [];
    if (this._fighters) {
      this._fighters.forEach((fighter: Fighter | null, index: number) => {
        this._state.fighters[index] = fighter ? fighter.serialize() : null;
      });
    } else {
      //console.log('No fighters to serialize');
    }
    //console.log('Serialized fighters', { fightersState: this._state.fighters });
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

  public fillSlot(unitId: string, index: number, force?: boolean): void {
    if (!(index >= 0 && index <= 4)) {
      throw Error("Cannot fill this slot - no such a slot");
    }

    const unit = _.cloneDeep(this._core.inventory.getUnit(unitId) as Unit);
    if (!unit) {
      throw new Error(`[fillSlot] Unit #${unitId} not found in the inventory`);
    }

    if (!force && this.getFighterByTemplate(unit.template)) {
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
      if (
        this._fighters[index] &&
        this._fighters[index].unit.unitId === unitId
      ) {
        this.fillSlot(unitId, index, true);
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
          const tier = parseInt(fighterTier);
          for (let i = 0; i < tier; i++) {
            const sourceId = fighterTribe;
            const caseId = tierCount - 2;
            bonuses.push({
              source: BUFF_SOURCE_SQUAD,
              sourceId,
              caseId,
              subEffect: 'no',
              ...SQUAD_BONUSES[sourceId][i][caseId]
            } as BattleBuff);
          }
        }
      });
    });

    // Apply bonuses
    this.fighters.forEach((fighter) => {
      fighter.buffs.reset(true);
      bonuses.forEach((bonus) =>
        fighter.buffs.addBuff(bonus, false)
      );
    });

    this._state.bonuses = bonuses;
  }

  public updatePower() {
    if (!this.fighters.length) {
      this._state.power = 0;
      return;
    }

    const totalPower = this.fighters.reduce(
      (prev: number, figher: Fighter) => {
        const modifiers = { 1: 1, 2: 3, 3: 9 };
        return prev + (figher.unit.power * modifiers[figher.unit.tier]);
      },
      0
    );
    this._state.power = totalPower;
  }

  public includesUnit(unitId: string): boolean {
    return (
      this.fighters.findIndex((fighters) => fighters.unit.unitId === unitId) !==
      -1
    );
  }

  public updateStat(): void {
    this.setBonuses();
    this.updatePower();
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
      this.fighters.find((fighter) => fighter.unit.template === template) ||
      null
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
    this.updatePower();
    this.sync();
  }

  public maximize(): void {
    this.fighters.forEach((fighter) => fighter.unit.maximize());
    this.updatePower();
    this.sync();
  }
}
