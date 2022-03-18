import _ from "lodash";
import { UNIT_CLASS_CLOWN, UNIT_CLASS_JACK, UNIT_CLASS_TEETH, UNIT_CLASS_HARLEQUIN, UNIT_CLASS_BOSS, UNIT_CLASS_HERO } from "../../knightlands-shared/april";
import { AprilMap } from "./AprilMap";
import { Unit } from "./units/Unit";

export class AprilDamage {
  private _map: AprilMap;

  constructor(map: AprilMap) {
    this._map = map;
  }

  public getDamageBlueprint(unit: Unit): number[] {
    let matrixFunc = null;
    let relativeDmgMap = null;

    switch (unit.unitClass) {
      case UNIT_CLASS_TEETH: {
        // Attacks distance: 1 cell
        // Attacks direction: all
        // Damage on the spot: no
        relativeDmgMap = [
          [-1, -1],
          [-1,  0],
          [-1,  1],
          [ 0, -1],
          [ 0,  1],
          [ 1, -1],
          [ 1,  0],
          [ 1,  1],
        ];
        break;
      }
      case UNIT_CLASS_CLOWN:
      case UNIT_CLASS_JACK: {
        // Attacks distance: 1 cell
        // Attacks direction: vertical + horizontal
        // Damage on the spot: no
        relativeDmgMap = [
          [-1,  0],
          [ 0, -1],
          [ 0,  1],
          [ 1,  0],
        ];
        break;
      }
      case UNIT_CLASS_HARLEQUIN: {
        // Attacks distance: 2 cell
        // Attacks direction: vertical + horizontal
        // Damage on the spot: no
        relativeDmgMap = [
          [-2,  0],
          [-1,  0],
          [ 0, -2],
          [ 0, -1],
          [ 0,  1],
          [ 0,  2],
          [ 1,  0],
          [ 2,  0],
        ];
        break;
      }
      case UNIT_CLASS_BOSS: {
        // Attack sequence:
        // - All black cells
        // - All white cells
        // - UNIT_CLASS_TEETH
        // - All the boarder cells  
        if (unit.sequence === 0) {
          matrixFunc = (_, i) => i % 2 === 0 ? 1 : 0;
        } else if (unit.sequence === 1) {
          matrixFunc = (_, i) => i % 2 === 1 ? 1 : 0;
        } else if (unit.sequence === 2) {
          relativeDmgMap = [
            [-1, -1],
            [-1,  0],
            [-1,  1],
            [ 0, -1],
            [ 0,  1],
            [ 1, -1],
            [ 1,  0],
            [ 1,  1],
          ];
        } else if (unit.sequence === 3) {
          matrixFunc = (_, i) => {
            if (![6,7,8,11,12,13,16,17,18].includes(i)) return 1;
            return 0;
          };
        }
        break;
      }
    }

    if (relativeDmgMap) {
      let visibleDmg = this._map.movement.getVisibleIndexes(unit, relativeDmgMap);
      matrixFunc = (_, i) => {
        if (visibleDmg.includes(i)) return 1;
        return 0;
      }
    }

    const damageBlueprint = Array.from({ length: 25 }, matrixFunc) as number[];
    return damageBlueprint;
  }

  public getDamageMap(units: Unit[]): number[] {
    const damageMap = Array.from({ length: 25 }, () => 0) as number[];
    units.forEach((unit: Unit) => {
      if (unit.unitClass === UNIT_CLASS_HERO) {
        return;
      }
      const unitDamageMap = this.getDamageBlueprint(unit);
      unitDamageMap.forEach((dmg, i) => {
        damageMap[i] += dmg;
      })
    })
    return damageMap;
  }
}
