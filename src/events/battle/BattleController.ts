import _ from "lodash";
import Game from "../../game";
import * as battle from "../../../src/knightlands-shared/battle";
import User from "../../user";

import { BattleCore } from './services/BattleCore';
import { BattleSaveData } from './types';

const isProd = process.env.ENV == "prod";

export class BattleController {
  protected _battleCore: BattleCore;
  protected _user: User;

  constructor(user: User) {
    this._battleCore = new BattleCore(user);
    this._user = user;
  }

  get core(): BattleCore {
    return this._battleCore;
  }

  get rootUser(): User {
    return this._user;
  }

  async init() {
    console.log('BattleController.init', { user: this._user, userId: this._user ? this._user.id : null });
    const saveData = await Game.battleManager.loadProgress(this._user.id);
    console.log('BattleController progress loaded');
    this.core.init(saveData ? saveData.state as BattleSaveData : null);
  }

  async dispose() {
    console.log('BattleController.dispose');
    this.core.user.dispose();
    await this._save();
  }

  public getState(): BattleSaveData {
    return this.core.getState();
  }

  protected async _save() {
    console.log('BattleController.save');
    await Game.battleManager.saveProgress(this._user.id, { state: this.getState() });
  }

  async load() {
    console.log('BattleController.load');
    await this.core.load();
    return this.getState();
  }

  async addDailyReward() {
    await this.core.user.addDailyReward();
  }

  async claimReward(type: string, tribe?: string) {
    let items;
    switch (type) {
      case battle.REWARD_TYPE_RANKING: {
        items = await Game.battleManager.claimRankingRewards(this._user);
        break;
      }
      case battle.REWARD_TYPE_SQUAD: {
        items = await this.core.user.claimSquadReward(tribe);
        break;
      }
    }
    this.core.events.flush();
    return items;
  }

  async purchase(id: number, tribe?: string) {
    const items = this.core.user.purchase(id, tribe);
    this.core.events.flush();
    return items;
  }

  async fillSquadSlot(unitId: string, index: number) {
    this.core.game.fillSquadSlot(unitId, index);
    this.core.events.flush();
  }

  async clearSquadSlot(index: number) {
    this.core.game.clearSquadSlot(index);
    this.core.events.flush();
  }

  async upgradeUnitLevel(unitId: string) {
    this.core.inventory.upgradeUnitLevel(unitId);
    this.core.events.flush();
  }

  async upgradeUnitAbility(unitId: string, ability: string) {
    this.core.inventory.upgradeUnitAbility(unitId, ability);
    this.core.events.flush();
  }

  async setAdventuresDifficulty(difficulty: string) {
    this.core.adventures.setDifficulty(difficulty);
    this.core.events.flush();
  }

  async chooseAbility(abilityclass: string) {
    this.core.game.chooseAbility(abilityclass);
    this.core.events.flush();
  }

  async apply(index: number|null, ability: string|null) {
    this.core.game.apply(index, ability);
  }

  async skip() {
    this.core.game.skip();
    this.core.events.flush();
  }

  async enterLevel(location: number, level: number) {
    this.core.game.enterLevel(location, level);
    this.core.events.flush();
  }

  async enterDuel(difficulty: string) {
    this.core.game.enterDuel(difficulty);
    this.core.events.flush();
  }

  async getDuelOptions() {
    return this.core.game.getDuelOptions();
  }

  async restart() {
    this.core.events.flush();
  }

  async merge(template: number) {
    const newUnit = this.core.inventory.merge(template);
    this.core.events.flush();
    return newUnit;
  }

  async exit() {
    this.core.game.exit();
    this.core.events.flush();
  }

  async testAction(data) {
    if (isProd) return;

    if (data === 'win') {
      this.core.game.win();
    }
    if (data === 'loose') {
      this.core.game.loose();
    }
    switch (data.action) {
      case 'win':{
        this.core.game.win();
        break;
      }
      case 'resetDuelsCounter':{
        this.core.user.purgeCounters();
        break;
      }
      case 'loose':{
        this.core.game.loose();
        break;
      }
      case 'addUnit':{
        const unit = this.core.inventory.getRandomUnit();
        unit.modifyQuantity(2);
        unit.randomize();
        this.core.inventory.addUnit(unit);
        break;
      }
      case 'addTopUnits':{
        battle.SQUAD_REWARDS.forEach(entry => {
          entry.templates.forEach(template => {
            const unit = this.core.inventory.getNewUnit(template);
            this.core.inventory.addUnit(unit);
          });
        });
        break;
      }
      case 'clearUnits':{
        this.core.game.clearSquad();
        this.core.inventory.setUnits([]);
        break;
      }
      case 'increaseUnitExp':{
        this.core.inventory.addExp(data.unitTemplate, data.exp);
        break;
      }
      case 'buildSquad':{
        this.core.game.buildSquad();
        break;
      }
      case 'makeSquadTier2':{
        this.core.game.setUserSquadTier(2);
        break;
      }
      case 'makeSquadTier3':{
        this.core.game.setUserSquadTier(3);
        break;
      }
      case 'maxSquad':{
        this.core.game.maximizeUserSquad();
        break;
      }
    }
    this.core.events.flush();
  }

}
