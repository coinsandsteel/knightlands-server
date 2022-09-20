import _ from "lodash";
import { BattleBuff } from "../types";
import { Unit } from "./Unit";
import {
  ABILITY_TYPE_DE_BUFF,
  TERRAIN_ICE,
  TERRAIN_HILL,
  TERRAIN_WOODS,
  TERRAIN_SWAMP,
  TERRAIN_LAVA,
} from "../../../knightlands-shared/battle";
import { BattleEvents } from "../services/BattleEvents";
import { SETTINGS } from "../meta";
import { Fighter } from "./Fighter";

export default class UnitBuffs {
  protected _events: BattleEvents;
  protected _fighter: Fighter;
  protected _buffs: BattleBuff[];

  protected _modifiers: {
    speed: number;
    initiative: number;
    defence: number;
    power: number;
    attack: number;
    abilities: number;
  };

  protected _terrainModifiers = {
    [TERRAIN_ICE]: "ice-0",
    [TERRAIN_HILL]: "hill-0",
    [TERRAIN_WOODS]: "woods-0",
    [TERRAIN_SWAMP]: "swamp-0",
    [TERRAIN_LAVA]: "lava-0",
  };

  get fighter(): Fighter {
    return this._fighter;
  }

  get buffs(): BattleBuff[] {
    return this._buffs;
  }

  constructor(events: BattleEvents, fighter: Fighter, buffs?: BattleBuff[]) {
    this._events = events;
    this._fighter = fighter;
    this._buffs = buffs || [];
  }

  public serialize() {
    return this._buffs;
  }

  public update(initial?: boolean) {
    this._buffs.forEach((buff) => {
      // Terrain
      if (buff.terrain && buff.scheme) {
        this._terrainModifiers[buff.terrain] = buff.scheme;
      }
      // HP
      if (initial && buff.type === "hp") {
        const hp = Math.round(
          this.fighter.maxHp * this.getBuffModifier({ type: "hp" })
        );
        this.fighter.modifyHp(hp, true);
      }
    });

    // Characteristics
    this._modifiers.defence = this.getBuffModifier({ type: "defence" });
    this._modifiers.speed = this.getBuffModifier({ type: "speed" });
    this._modifiers.initiative = this.getBuffModifier({
      type: "initiative",
    });

    // Attack bonuses
    this._modifiers.power = this.getBuffModifier({ type: "power" });
    this._modifiers.attack = this.getBuffModifier({ type: "attack" });
    this._modifiers.abilities = this.getBuffModifier({
      type: "abilities",
    });

    // Stun
    const stunBuffs = this.getBuffs({ type: "stun" });
    if (stunBuffs.length) {
      this.fighter.setStunned(
        stunBuffs.some((buff) => Math.random() <= buff.probability)
      );
    } else {
      this.fighter.setStunned(false);
    }
  }

  public reset() {
    this._buffs = [];
    this._modifiers = {
      speed: -1,
      initiative: -1,
      defence: -1,
      power: -1,
      attack: -1,
      abilities: -1,
    };
  }

  public addBuff(buff: BattleBuff): void {
    buff.activated = false;

    if (buff.mode === "stack") {
      buff.stackValue = 0;
    }

    //this.log(`Buff added (need commit)`, buff);
    this._buffs.push(buff);

    this.fighter.commit();
    this._events.buffs(this.fighter.fighterId, this.buffs);

    if (["power", "attack", "abilities"].includes(buff.type)) {
      this._events.abilities(
        this.fighter.fighterId,
        this.fighter.abilities.serialize()
      );
    }
  }

  public removeBuffs(params: { source?: string; type?: string }): void {
    //this.log(`Remove buffs`, params);
    this._buffs = this._buffs.filter((buff) => {
      return !(buff.source === params.source && buff.type === params.type);
    });
  }

  public getBuffs(params: {
    source?: string;
    type?: string;
    trigger?: string;
  }): BattleBuff[] {
    return _.filter(this._buffs, params);
  }

  public getBuffModifier(params: { source?: string; type?: string }): number {
    const buffs = this.getBuffs(params);
    if (!buffs.length) {
      return 1;
    }

    let modifier = 1;
    buffs.forEach((buff) => {
      // Constant
      if (buff.mode === "constant" && !buff.trigger) {
        //{ source: "self-buff", mode: "constant", type: "power", modifier: 1.15 }
        //{ source: "squad", mode: "constant", type: "power", terrain: "hill", scheme: "hill-1" }
        modifier =
          modifier *
          (buff.terrain
            ? this.getTerrainModifier(buff.terrain)
            : buff.modifier);

        // Burst
      } else if (buff.mode === "burst") {
        //{ source: "squad", mode: "burst", type: "power", modifier: 1.3, probability: 0.07 },
        modifier =
          modifier * (Math.random() <= buff.probability ? buff.modifier : 1);

        // Stacked
      } else if (buff.mode === "stack" && buff.multiply) {
        modifier = modifier * (1 + buff.stackValue);
      }
    });

    return modifier;
  }

  public getBonusDelta(type: string): number {
    const buffs = this.getBuffs({ type });
    if (!buffs.length) {
      return 0;
    }

    let modifier = 0;
    buffs.forEach((buff) => {
      // Stacked
      if (buff.mode === "stack" && buff.sum) {
        modifier += buff.stackValue;
      } else if (
        buff.mode === "constant" &&
        buff.trigger === "debuff" &&
        buff.sum
      ) {
        modifier += this.getBuffs({ source: ABILITY_TYPE_DE_BUFF }).length
          ? buff.delta
          : 0;
      }
    });

    return modifier;
  }

  public handleDamageCallback() {
    // { source: "squad", mode: "stack", type: "power", trigger: "damage", delta: 2.5, percents: true, max: 15 },
    // { source: "squad", mode: "stack", type: "attack", trigger: "damage", delta: 2.5, percents: true, max: 15 },
    // { source: "squad", mode: "stack", type: "defence", trigger: "damage", delta: 1, max: 4 },
    const buffs = this.getBuffs({ trigger: "damage" });
    if (buffs.length) {
      buffs.forEach((buff) => {
        // Stack
        if (
          buff.mode === "stack" &&
          typeof buff.stackValue !== "undefined" &&
          buff.stackValue < buff.max
        ) {
          buff.stackValue += buff.delta;
          this.log(`${buff.type} stacked`, buff);
        }
      });
    }
  }

  public decreaseBuffsEstimate(): void {
    this._buffs.forEach((buff) => {
      if (!_.isUndefined(buff.estimate) && !buff.activated) {
        buff.activated = true;
        return;
      }

      if (_.isNumber(buff.estimate) && buff.estimate >= 0) {
        buff.estimate--;
      }
    });

    const filterFunc = (buff) =>
      _.isNumber(buff.estimate) && buff.estimate <= 0;
    const outdatedBuffs = _.remove(this._buffs, filterFunc);

    if (outdatedBuffs.length) {
      this.log(`Buffs outdated (need commit)`, { outdatedBuffs });
      this.fighter.commit();
    }
  }

  public launchTerrainEffect(terrain?: string): void {
    switch (terrain) {
      case TERRAIN_LAVA: {
        const damage = this.getLavaDamage();
        this.fighter.modifyHp(-damage);
        this.log(`Lava damage is ${damage}`);
        break;
      }
      case TERRAIN_ICE:
      case TERRAIN_SWAMP:
      case TERRAIN_HILL:
      case TERRAIN_WOODS: {
        // Remove existing TERRAIN_ICE and TERRAIN_SWAMP effects
        this.removeBuffs({
          source: "terrain",
          type: SETTINGS.terrain[terrain].type,
        });

        // Hills, highlands - Increase damage to enemies by 25%
        // Forest - Increases unit's defense by 25%
        this.addBuff({
          source: "terrain",
          sourceId: terrain,
          mode: "constant",
          type: SETTINGS.terrain[terrain].type,
          modifier: this.getTerrainModifier(terrain),
          caseId: parseInt(this._terrainModifiers[terrain].split("-")[1]),
        });
        break;
      }
      default: {
        this.removeBuffs({
          source: "terrain",
        });
        break;
      }
    }
  }

  public getLavaDamage(): number {
    return Math.round(this.fighter.maxHp * this.getTerrainModifier(TERRAIN_LAVA));
  }

  public getTerrainModifier(terrain: string): number {
    return SETTINGS.terrain[terrain].modifiers[this._terrainModifiers[terrain]];
  }

  public setTerrainModifier(terrain: string, value: number): void {
    this._terrainModifiers[terrain] = value;
  }

  protected log(message: string, payload?: any) {
    //console.log(`[Unit id=${this._unitId} fighterId=${this._fighterId}] ${message}`, payload);
  }
}
