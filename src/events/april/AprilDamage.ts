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
    let matrixFunc;
    const unitIndex = unit.index;

    switch (unit.unitClass) {
      case UNIT_CLASS_TEETH: {
        // Attacks distance: 1 cell
        // Attacks direction: all
        // Damage on the spot: no
        matrixFunc = (_, i) => {
          let diff = unitIndex - i;
          if (diff === 0) return 0;
          if ([6,5,4,1].includes(Math.abs(diff))) return 1;
          return 0;
        };
        break;
      }
      case UNIT_CLASS_CLOWN:
      case UNIT_CLASS_JACK: {
        // Attacks distance: 1 cell
        // Attacks direction: vertical + horizontal
        // Damage on the spot: no
        matrixFunc = (_, i) => {
          let diff = unitIndex - i;
          if (diff === 0) return 0; 
          if ([5,1].includes(Math.abs(diff))) return 1;
          return 0;
        };
        break;
      }
      case UNIT_CLASS_HARLEQUIN: {
        // Attacks distance: 2 cell
        // Attacks direction: vertical + horizontal
        // Damage on the spot: no
        matrixFunc = (_, i) => {
          let diff = unitIndex - i;
          if (diff === 0) return 0; 
          if ([5,1].includes(Math.abs(diff))) return 1;
          return 0;
        };
        break;
      }
      case UNIT_CLASS_BOSS: {
        // Attack sequence:
        // - All black cells
        // - All white cells
        // - UNIT_CLASS_TEETH
        // - All the boarder cells   
        const sequence = [
          (_, i) => i % 2 === 0 ? 1 : 0,
          (_, i) => i % 2 === 1 ? 1 : 0,
          (_, i) => {
            let diff = unitIndex - i;
            if (diff === 0) return 0;
            if ([6,5,4,1].includes(Math.abs(diff))) return 1;
            return 0;
          },
          (_, i) => {
            if (![6,7,8,11,12,13,16,17,18].includes(i)) return 1;
            return 0;
          },
        ];
        matrixFunc = sequence[unit.sequence];
        break;
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
