import _ from "lodash";

import { suite, test } from '@testdeck/mocha';
import * as _chai from 'chai';
import { expect } from 'chai';
import { BattleCore } from '../src/events/battle/services/BattleCore';
import { ObjectId } from 'mongodb';
import { ABILITIES, ABILITY_SCHEME, UNITS } from '../src/events/battle/meta';
import { Unit } from '../src/events/battle/units/Unit';
import { ABILITY_AGRESSION, ABILITY_ATTACK, ABILITY_STUN, ABILITY_TYPE_ATTACK, ABILITY_TYPE_BUFF, ABILITY_TYPE_DE_BUFF, ABILITY_TYPE_FLIGHT, ABILITY_TYPE_HEALING, ABILITY_TYPE_JUMP, ABILITY_TYPE_SELF_BUFF, GAME_DIFFICULTY_LOW, GAME_DIFFICULTY_MEDIUM, GAME_MODE_DUEL, UNIT_CLASS_MELEE, UNIT_CLASS_TANK } from "../src/knightlands-shared/battle";

_chai.should();
_chai.expect;

@suite class AbilitesTest {
  private core: BattleCore;

  before() {
    this.core = new BattleCore(new ObjectId("000000000000000000000000"));
    this.core.init();
  }

  @test 'initial state'() {
    return;
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
        "counters": {
          "energy": 0
        }
      }
    });
  }

  @test 'ability values'() {
    return;
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
        if (abilityClass === ABILITY_ATTACK) {
          continue;
        }

        //console.log(`[${abilityClass} effects] Testing "${abilityClass}"`);

        // Clear state
        this.core.game.exit();

        // Find unit which can use ability
        const unitBlueprint = UNITS.find(bluprint => bluprint.abilityList.includes(abilityClass));

        // Set user squad
        //console.log(`[${abilityClass} effects] Spaw user squad`);
        this.core.game.spawnUserSquad([
          {
            ...unitBlueprint,
            tier: 3,
            level: { current: 45, next: null, price: null},
            levelInt: 45
          },
          {
            ...unitBlueprint,
            tier: 3,
            level: { current: 45, next: null, price: null},
            levelInt: 45
          },
        ]);

        // Set enemy squad
        //console.log(`[${abilityClass} effects] Spaw enemy squad`);
        this.core.game.spawnEnemySquad([
          {
            ...unitBlueprint,
            tier: 3,
            level: { current: 45, next: null, price: null},
            levelInt: 45
          }
        ]);

        // Set map
        this.core.game.terrain.setEmptyMap();
        expect(this.core.game.terrain.getState().tiles, `[${abilityClass} effects] Wrong terrain`).to.be.an('array').that.have.lengthOf(25);

        // Start combat
        this.core.game.setCombatStarted(true);
        expect(this.core.game.getState().combat.started, `[${abilityClass} effects] Combat not started`).to.equal(true);

        // Iterate ability levels
        const userUnit = this.core.game.userUnits[0];
        const allyUnit = this.core.game.userUnits[1];
        const enemyUnit = this.core.game.enemyUnits[0];
        let abilityData = userUnit.getAbilityByClass(abilityClass);
        let abilityStat = userUnit.getAbilityStat(abilityClass);
        let abilityScheme = ABILITY_SCHEME[userUnit.level.current-1][abilityData.tier-1];

        for (let abilityLevel = 1; abilityLevel <= abilityScheme.lvl; abilityLevel++) {
          userUnit.reset();
          userUnit.setIndex(0);

          enemyUnit.reset();
          enemyUnit.setIndex(1);

          allyUnit.reset();
          allyUnit.setIndex(5);

          expect(userUnit.isDead, `[${abilityClass} effects] User unit is alive`).to.equal(false);
          expect(allyUnit.isDead, `[${abilityClass} effects] Ally unit is alive`).to.equal(false);
          expect(enemyUnit.isDead, `[${abilityClass} effects] Enemy unit is alive`).to.equal(false);

          expect(userUnit.index, `[${abilityClass} effects] User unit index != 0`).to.equal(0);
          expect(allyUnit.index, `[${abilityClass} effects] User unit index != 5`).to.equal(5);
          expect(enemyUnit.index, `[${abilityClass} effects] Enemy unit index != 1`).to.equal(1);

          userUnit.setAbilityLevel(abilityClass, abilityLevel);
          abilityData = userUnit.getAbilityByClass(abilityClass);
          abilityStat = userUnit.getAbilityStat(abilityClass);

          expect(userUnit.canUseAbility(abilityClass), `[${abilityClass} effects] Unit ${userUnit.class} cannot use ability "${abilityClass}"`).to.equal(true);

          // Iterate turns
          for (let turn = 1; turn <= 10; turn++) {
            const drawNumber = Math.floor((turn+1)/2);
            const ability = turn === 1 ? abilityClass : ABILITY_ATTACK;
            const source = (turn % 2 ? userUnit : enemyUnit);
            const choosedAbilityData = source.getAbilityByClass(ability);

            const target = (
              turn % 2 && choosedAbilityData.abilityType !== ABILITY_TYPE_SELF_BUFF ?
                (choosedAbilityData.abilityType === ABILITY_TYPE_BUFF ? allyUnit : enemyUnit)
                :
                userUnit
              );

              const before = {
                targetHp: _.clone(target.hp)
              };

            //console.log(`[${abilityClass} effects] Draw #${drawNumber}, turn #${turn}`, { sourceHP: source.hp, targetHP: target.hp });
            this.core.game.handleAction(source, target.index, ability);

            if (target.isDead) {
              //expect(target.isDead, `[${abilityClass} effects] Target is dead`).to.equal(false);
              break
            }

            const after = {
              targetHp: _.clone(target.hp)
            };

            // Test damage
            if (!source.isStunned && abilityMeta.damageScheme === -1) {
              //console.log("Unit attacks", { source, target, ability });
              //try {
                expect(after.targetHp, `[${abilityClass} effects] No damage done via "${abilityClass}"`).to.be.below(before.targetHp);
              /*} catch (e) {
                console.error(e.message);
              }*/
            } else if (source.isStunned && abilityMeta.damageScheme === -1) {
              expect(after.targetHp, `[${abilityClass} effects] Stuned unit released a damage via "${abilityClass}"`).to.equal(before.targetHp);
            }

            if (turn % 2 === 0) {
              this.core.game.userSquad.callbackDrawFinished();
              this.core.game.enemySquad.callbackDrawFinished();
            }

            // Test effects
            if (
              ability === abilityClass
              &&
              abilityStat.effects.length
            ) {
              let expectedBuffsCount = 0;
              for (let effect of abilityStat.effects) {
                if (drawNumber-1 <= (effect.estimate || abilityMeta.duration)) {
                  expectedBuffsCount++;
                }
              }

              const foundBuffs = _.filter(
                target.buffs,
                { sourceId: abilityClass }
              );

              //console.log(`[${abilityClass} effects] Buffs count check`, { expected: expectedBuffsCount, current: foundBuffs.length });

              //try {
                expect(foundBuffs, `[${abilityClass} effects] Effect not found`)
                  .to.be.an('array')
                  .that.have.lengthOf(expectedBuffsCount);
              /*} catch (e) {
                console.error(e.message, effect);
              }*/
            }
          }
        }
      }
    }
  }

  @test 'target cells'() {
    for (let unitClass in ABILITIES) {
      for (let abilityClass in ABILITIES[unitClass]) {
        const abilityMeta = ABILITIES[unitClass][abilityClass];
        if (
          abilityClass === ABILITY_ATTACK
          ||
          abilityMeta.abilityType === ABILITY_TYPE_FLIGHT
          ||
          abilityMeta.abilityType === ABILITY_TYPE_SELF_BUFF
          ||
          abilityMeta.abilityType === ABILITY_TYPE_JUMP
        ) {
          continue;
        }

        //console.log(`[${abilityClass} effects] Testing "${abilityClass}"`);

        // Clear state
        this.core.game.exit();

        // Find unit which can use ability
        const unitBlueprint = UNITS.find(bluprint => bluprint.abilityList.includes(abilityClass));

        // Set user squad
        //console.log(`[${abilityClass} effects] Spaw user squad`);
        this.core.game.spawnUserSquad([
          {
            ...unitBlueprint,
            index: 0,
            tier: 3,
            level: { current: 45, next: null, price: null},
            levelInt: 45
          },
          {
            ...unitBlueprint,
            index: 2,
            tier: 3,
            level: { current: 45, next: null, price: null},
            levelInt: 45
          },
          {
            ...unitBlueprint,
            index: 6,
            tier: 3,
            level: { current: 45, next: null, price: null},
            levelInt: 45
          },
        ]);
        this.core.game.userSquad.regenerateFighterIds();

        // Set enemy squad
        //console.log(`[${abilityClass} effects] Spaw enemy squad`);
        this.core.game.spawnEnemySquad([
          {
            ...unitBlueprint,
            index: 10,
            tier: 3,
            level: { current: 45, next: null, price: null},
            levelInt: 45
          },
          {
            ...unitBlueprint,
            index: 11,
            tier: 3,
            level: { current: 45, next: null, price: null},
            levelInt: 45
          },
          {
            ...unitBlueprint,
            index: 12,
            tier: 3,
            level: { current: 45, next: null, price: null},
            levelInt: 45
          },
        ]);
        this.core.game.enemySquad.regenerateFighterIds();

        // Set map
        this.core.game.terrain.setEmptyMap();
        expect(this.core.game.terrain.getState().tiles, `[${abilityClass} effects] Wrong terrain`).to.be.an('array').that.have.lengthOf(25);

        // Start combat
        this.core.game.setCombatStarted(true);
        expect(this.core.game.getState().combat.started, `[${abilityClass} effects] Combat not started`).to.equal(true);

        expect(this.core.game.userUnits[0].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(0);
        expect(this.core.game.userUnits[1].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(2);
        expect(this.core.game.userUnits[2].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(6);

        expect(this.core.game.enemyUnits[0].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(10);
        expect(this.core.game.enemyUnits[1].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(11);
        expect(this.core.game.enemyUnits[2].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(12);

        // Iterate ability levels
        const userUnit = this.core.game.userUnits[2];
        const abilityData = userUnit.getAbilityByClass(abilityClass);
        const attackAreaData = this.core.game.combat.getAttackAreaData(userUnit, abilityClass, true);
        //console.log(`[${abilityClass} target cells]`, attackAreaData.targetCells);
        switch (abilityData.abilityType) {
          case ABILITY_TYPE_JUMP:
          case ABILITY_TYPE_DE_BUFF:
          case ABILITY_TYPE_ATTACK: {
            expect(attackAreaData.targetCells, `[${abilityClass} target cells] Wrong target cells`).to.have.members([10, 11, 12]);
            break;
          }
          case ABILITY_TYPE_HEALING:
          case ABILITY_TYPE_BUFF: {
            expect(attackAreaData.targetCells, `[${abilityClass} target cells] Wrong target cells`).to.have.members([0, 2]);
            break;
          }
          case ABILITY_TYPE_SELF_BUFF: {
            expect(attackAreaData.targetCells, `[${abilityClass} target cells] Wrong target cells`).to.have.members([6]);
            break;
          }
        }
      }
    }
  }

  @test 'agression'() {
    const unitClass = UNIT_CLASS_TANK;
    const abilityClass = ABILITY_AGRESSION;

    //console.log(`[${abilityClass} effects] Testing "${abilityClass}"`);

    // Clear state
    this.core.game.exit();

    // Find unit which can use ability
    const unitBlueprint = UNITS.find(bluprint => bluprint.abilityList.includes(abilityClass));
    const enemyBlueprint = UNITS.find(bluprint => bluprint.unitClass === UNIT_CLASS_MELEE);

    // Set user squad
    //console.log(`[${abilityClass} effects] Spaw user squad`);
    this.core.game.spawnUserSquad([
      {
        ...unitBlueprint,
        index: 0,
        tier: 1,
        level: { current: 1, next: null, price: null},
        levelInt: 1
      },
      {
        ...unitBlueprint,
        index: 1,
        tier: 1,
        level: { current: 1, next: null, price: null},
        levelInt: 1
      },
      {
        ...unitBlueprint,
        index: 2,
        tier: 1,
        level: { current: 1, next: null, price: null},
        levelInt: 1
      },
      {
        ...unitBlueprint,
        index: 10,
        tier: 1,
        level: { current: 1, next: null, price: null},
        levelInt: 1
      },
      {
        ...unitBlueprint,
        index: 11,
        tier: 1,
        level: { current: 1, next: null, price: null},
        levelInt: 1
      },
      {
        ...unitBlueprint,
        index: 12,
        tier: 1,
        level: { current: 1, next: null, price: null},
        levelInt: 1
      },
    ]);
    this.core.game.userSquad.regenerateFighterIds();

    // Set enemy squad
    //console.log(`[${abilityClass} effects] Spaw enemy squad`);
    this.core.game.spawnEnemySquad([
      {
        ...enemyBlueprint,
        index: 6,
        tier: 3,
        level: { current: 45, next: null, price: null},
        levelInt: 45
      }
    ]);
    this.core.game.enemySquad.regenerateFighterIds();

    // Set map
    this.core.game.terrain.setEmptyMap();
    expect(this.core.game.terrain.getState().tiles, `[${abilityClass} effects] Wrong terrain`).to.be.an('array').that.have.lengthOf(25);

    // Start combat
    this.core.game.setCombatStarted(true);
    expect(this.core.game.getState().combat.started, `[${abilityClass} effects] Combat not started`).to.equal(true);

    expect(this.core.game.userUnits[0].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(0);
    expect(this.core.game.userUnits[1].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(1);
    expect(this.core.game.userUnits[2].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(2);

    expect(this.core.game.enemyUnits[0].index, `[${abilityClass} target cells] Wrong unit index`).to.equal(6);

    const userUnit = this.core.game.userUnits[1];
    const enemyUnit = this.core.game.enemyUnits[0];
    let abilityStat = userUnit.getAbilityStat(abilityClass);

    // Iterate turns
    for (let turn = 1; turn <= 10; turn++) {
      const drawNumber = Math.floor((turn+1)/2);
      const ability = turn === 1 ? abilityClass : ABILITY_ATTACK;

      const usersDraw = !!(turn % 2);
      const source = (usersDraw ? userUnit : enemyUnit);
      const target = (usersDraw ? enemyUnit : userUnit);

      //console.log({ usersDraw, source, target });
      //console.log(`[${abilityClass} effects] Draw #${drawNumber}, turn #${turn} - ${ability} applied`, { sourceHP: source.hp, targetHP: target.hp });
      this.core.game.handleAction(source, target.index, ability);

      expect(target.isDead, `[${abilityClass} effects] Target is dead`).to.equal(false);

      // Check that agression does work
      if (!usersDraw) {
        let shouldBeAgro = false;
        for (let effect of abilityStat.effects) {
          if (drawNumber-1 <= effect.estimate) {
            shouldBeAgro = true;
          }
        }

        const attackAreaData = this.core.game.combat.getAttackAreaData(enemyUnit, ability, true);
        /*console.log({
          buffs: source.buffs,
          shouldBeAgro,
          targetCells: attackAreaData.targetCells
        });*/
        if (shouldBeAgro) {
          expect(source.hasAgro, `[${abilityClass} effects] Agression doesn't work`).to.equal(true);
          expect(attackAreaData.targetCells, `[${abilityClass} effects] Agression doesn't work`).to.have.members([1]);
        } else {
          expect(source.hasAgro, `[${abilityClass} effects] Agression doesn't work`).to.equal(false);
          expect(attackAreaData.targetCells, `[${abilityClass} effects] Agression works icorrect`).to.have.members([0, 1, 2, 10, 11, 12]);
        }
      }

      // Draw finished
      if (turn % 2 === 0) {
        //console.log(`[${abilityClass} effects] Draw finished`);
        this.core.game.userSquad.callbackDrawFinished();
        this.core.game.enemySquad.callbackDrawFinished();
      }
    }
  }

  @test 'shield wall, cannot move'() {

  }
}