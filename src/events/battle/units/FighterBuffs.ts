import _ from "lodash";
import { BattleBuff } from "../types";
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
    this._modifiers = {
      speed: -1,
      initiative: -1,
      defence: -1,
      power: -1,
      attack: -1,
      abilities: -1,
    };
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
      if (initial && buff.target === "hp") {
        const hp = Math.round(
          this.fighter.unit.maxHp * this.getBuffModifier({ type: "hp" })
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
    if (buff.mode === "stack") {
      buff.stackValue = 0;
    }

    this._buffs.push(buff);
    this.fighter.update();
    this._events.buffs(this.fighter.fighterId, this.buffs);

    if (buff.target !== "no") {
      this._events.abilities(
        this.fighter.fighterId,
        this.fighter.abilities.serialize()
      );
    }
  }

  public removeBuffs(params: { source?: string; target?: string }): void {
    //this.log(`Remove buffs`, params);
    this._buffs = this._buffs.filter((buff) => {
      return !(buff.source === params.source && buff.target === params.target);
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
      if (buff.mode === "constant" && buff.operation === "multiply" && !buff.trigger) {
        //{ source: "self-buff", mode: "constant", type: "power", modifier: 1.15 }
        //{ source: "squad", mode: "constant", type: "power", terrain: "hill", scheme: "hill-1" }
        modifier =
          modifier *
          (buff.terrain
            ? this.getTerrainModifier(buff.terrain)
            : buff.value);

        // Burst
      } else if (buff.mode === "burst") {
        //{ source: "squad", mode: "burst", type: "power", modifier: 1.3, probability: 0.07 },
        modifier =
          modifier * (Math.random() <= buff.probability ? buff.value : 1);

        // Stacked
      } else if (buff.mode === "stack" && buff.operation === "multiply") {
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
      if (buff.mode === "stack" && buff.operation === "add") {
        modifier += buff.stackValue;
      } else if (
        buff.mode === "constant" &&
        buff.trigger === "debuff" &&
        buff.operation === "add"
      ) {
        modifier += this.getBuffs({ source: ABILITY_TYPE_DE_BUFF }).length
          ? buff.value
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
          buff.stackValue !== undefined &&
          buff.stackValue < buff.max
        ) {
          buff.stackValue += buff.value;
          //this.log(`${buff.type} stacked`, buff);
        }
      });
    }
  }

  public decreaseBuffsEstimate(): void {
    this._buffs.forEach((buff) => {
      if (!_.isUndefined(buff.duration) && !buff.activated) {
        buff.activated = true;
        return;
      }

      if (_.isNumber(buff.duration) && buff.duration >= 0) {
        buff.duration--;
      }
    });

    const filterFunc = (buff) =>
      _.isNumber(buff.duration) && buff.duration <= 0;
    const outdatedBuffs = _.remove(this._buffs, filterFunc);

    if (outdatedBuffs.length) {
      this.log(`Buffs outdated (need commit)`, { outdatedBuffs });
      this.fighter.update();
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
          target: SETTINGS.terrain[terrain].target,
        });

        // Hills, highlands - Increase damage to enemies by 25%
        // Forest - Increases unit's defense by 25%
        this.addBuff({
          name: TERRAIN_WOODS,
          target: SETTINGS.terrain[terrain].target,
          subEffect: "no",
          operation: "multiply",
          probability: 1,
          value: this.getTerrainModifier(terrain),
          duration: Infinity,

          source: "terrain",
          sourceId: terrain,
          mode: "constant",
          activated: true
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
    return Math.round(this.fighter.unit.maxHp * this.getTerrainModifier(TERRAIN_LAVA));
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
