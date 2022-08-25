import { suite, test } from '@testdeck/mocha';
import * as _chai from 'chai';
import { expect } from 'chai';
import { BattleCore } from '../src/events/battle/services/BattleCore';
import { ObjectId } from 'mongodb';
import { characteristics } from './chars';
import { Unit } from '../src/events/battle/units/Unit';
import { UNITS } from '../src/events/battle/meta';

_chai.should();
_chai.expect;

@suite class CharacteristicsTest {
  private core: BattleCore;

  before() {
    this.core = new BattleCore(new ObjectId("000000000000000000000000"));
    this.core.init();
  }

  @test 'unit characterictics'() {
    const charMap = ['hp', 'damage', 'defence', 'speed', 'initiative'];
    for (let unitClass in characteristics) {
      const blueprint = UNITS.find(bluprint => bluprint.unitClass === unitClass);
      for (let level = 1; level <= 45; level++) {
        const unit = new Unit({
          ...blueprint,
          tier: 3, 
          level: { current: level, next: null, price: null},
          levelInt: level
        }, this.core.events);

        const expectedCharacteristics = characteristics[unitClass][level-1];
        try {
          charMap.forEach((property, index) => {
            expect(unit[property], `[Characteristics] ${unitClass} lvl=${level} ${property}`).to.equal(expectedCharacteristics[index]);
          });
        } catch (e) {
          console.error(e.message);
        }
      }
    }
  }
}