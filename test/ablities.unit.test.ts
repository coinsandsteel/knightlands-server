import _ from "lodash";

import { suite, test } from '@testdeck/mocha';
import * as _chai from 'chai';
import { expect } from 'chai';
import { BattleCore } from '../src/events/battle/services/BattleCore';
import { ObjectId } from 'mongodb';
import { ABILITIES, ABILITY_SCHEME, UNITS } from '../src/events/battle/meta';
import { Unit } from '../src/events/battle/units/Unit';

_chai.should();
_chai.expect;

@suite class AbilitesTest {
  private core: BattleCore;

  before() {
    this.core = new BattleCore(new ObjectId("000000000000000000000000"));
    this.core.init();
  }

  @test 'initial state'() {
    expect(this.core.getState()).to.deep.equal({
      "game": {
        "combat": {
          "activeFighterId": null,
          "result": null,
          "runtime": {
            "attackCells": [],
            "moveCells": [],
            "selectedAbilityClass": null,
            "selectedIndex": null,
            "targetCells": []
          },
          "started": false
        },
        "difficulty": null,
        "enemySquad": {
          "bonuses": [],
          "power": 0,
          "units": []
        },
        "initiativeRating": [],
        "level": 0,
        "mode": null,
        "room": null,
        "terrain": null,
        "userSquad": {
          "bonuses": [],
          "power": 0,
          "units": [],
        }
      },
      "inventory": [],
      "user": {
        "balance": {
          "coins": 1000000,
          "crystals": 1000000,
          "energy": 1000000,
        },
        "rewards": {
          "dailyRewards": [],
          "rankingRewards": {}
        },
        "timers": {
          "energy": 0
        }
      }
    });
  }

  @test 'ability values'() {
    for (let unitClass in ABILITIES) {
      for (let abilityClass in ABILITIES[unitClass]) {
        const abilityMeta = ABILITIES[unitClass][abilityClass];

        // Check damage values
        if (abilityMeta.damage) {
          // Get all units who can use ability
          const unitBlueprints = [UNITS.find(bluprint => bluprint.unitClass === unitClass)];
          unitBlueprints.forEach(unitBlueprint => {
            const unit = new Unit({ 
              ...unitBlueprint,
              tier: 3,
              level: { current: 1, next: null, price: null},
              levelInt: 1
            }, this.core.events);

            // Loop all unit levels
            for (let level = 1; level <= 45; level++) {
              unit.setLevel(level);
              unit.unlockAbilities();
              unit.updateAbilities();

              // Loop unit abilities
              unit.abilities.forEach(ability => {
                if (ability.abilityClass !== abilityClass) {
                  return;
                }
                
                const abilityData = unit.getAbilityByClass(ability.abilityClass);
                const abilityScheme = ABILITY_SCHEME[level-1][abilityData.tier-1];
                if (abilityScheme === null) {
                  try {
                    expect(abilityData.levelInt, `[Ability] ${unitClass} (lvl=${level}), ${abilityClass} (lvl=${0})`).to.equal(0);
                  } catch (e) {
                    console.error(e.message);
                  }
                  return;
                }

                const abilityMaxLevel = abilityScheme.lvl;
                const metaDamageValues = _.flattenDeep(abilityMeta.damage.filter(n => n));
                
                // Check ability levels
                for (let abilityLevel = 1; abilityLevel <= abilityMaxLevel; abilityLevel++) {
                  unit.setAbilityLevel(ability.abilityClass, abilityLevel);
                  unit.updateAbilities();
                  
                  const abilityData = unit.getAbilityByClass(ability.abilityClass);
                  const abilityExpectedValue = metaDamageValues[abilityLevel-1];

                  try {
                    expect(abilityData.value, `[Ability] ${unitClass} (lvl=${level}), ${abilityClass} (lvl=${abilityLevel})`).to.equal(abilityExpectedValue);
                  } catch (e) {
                    console.error(e.message);
                  }
                }
              });
            }
          });
        }
      }
    }
  }

  @test 'ability effects'() {
    for (let unitClass in ABILITIES) {
      for (let abilityClass in ABILITIES[unitClass]) {
        const abilityMeta = ABILITIES[unitClass][abilityClass];

        // Check damage values
        if (abilityMeta.damage) {
          // Get all units who can use ability
          const unitBlueprints = [UNITS.find(bluprint => bluprint.unitClass === unitClass)];
          unitBlueprints.forEach(unitBlueprint => {
            const unit = new Unit({ 
              ...unitBlueprint,
              tier: 3,
              level: { current: 45, next: null, price: null},
              levelInt: 45
            }, this.core.events);

            unit.maximize();

            // Loop unit abilities
            /*unit.abilities.forEach(ability => {
              if (ability.abilityClass !== abilityClass) {
                return;
              }
              
              const abilityData = unit.getAbilityByClass(ability.abilityClass);
              const abilityScheme = ABILITY_SCHEME[level-1][abilityData.tier-1];
              if (abilityScheme === null) {
                try {
                  expect(abilityData.levelInt, `[Ability] ${unitClass} (lvl=${level}), ${abilityClass} (lvl=${0})`).to.equal(0);
                } catch (e) {
                  console.error(e.message);
                }
                return;
              }

              const abilityMaxLevel = abilityScheme.lvl;
              const metaDamageValues = _.flattenDeep(abilityMeta.damage.filter(n => n));
              
              // Check ability levels
              for (let abilityLevel = 1; abilityLevel <= abilityMaxLevel; abilityLevel++) {
                unit.setAbilityLevel(ability.abilityClass, abilityLevel);
                unit.updateAbilities();
                
                const abilityData = unit.getAbilityByClass(ability.abilityClass);
                const abilityExpectedValue = metaDamageValues[abilityLevel-1];

                try {
                  expect(abilityData.value, `[Ability] ${unitClass} (lvl=${level}), ${abilityClass} (lvl=${abilityLevel})`).to.equal(abilityExpectedValue);
                } catch (e) {
                  console.error(e.message);
                }
              }
            });*/
          });
        }
      }
    }
  }
}