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
    this._battleCore = new BattleCore(user.id);
    this._user = user;
  }

  get core(): BattleCore {
    return this._battleCore;
  }

  get rootUser(): User {
    return this._user;
  }

  async init() {
    //console.log('Controller init');
    const saveData = await Game.battleManager.loadProgress(this._user.id);
    this.core.init(saveData ? saveData.state as BattleSaveData : null);
  }

  async dispose() {
    this.core.dispose();
    await this._save();
  }

  public getState(): BattleSaveData {
    return this.core.getState();
  }

  protected async _save() {
    await Game.battleManager.saveProgress(this._user.id, { state: this.getState() });
  }

  async load() {
    //('Controller load');
    await this.core.load();
    return this.getState();
  }

  async claimReward(type: string) {
    let items;
    switch (type) {
      case battle.REWARD_TYPE_DAILY: {
        await this.core.user.claimDailyReward();
        break;
      }
      case battle.REWARD_TYPE_RANKING: {
        items = await Game.battleManager.claimRankingRewards(this._user);
        break;
      }
      case battle.REWARD_TYPE_SQUAD: {
        items = await this.core.user.claimSquadReward();
        break;
      }
    }
    this.core.events.flush();
    return items;
  }

  async purchase(commodity: string, currency: string, shopIndex: number) {
    this.core.user.purchase(commodity, currency, shopIndex);
    this.core.events.flush();
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

  async enterLevel(room: number, level: number) {
    this.core.game.enterLevel(room, level);
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

  async exit() {
    this.core.game.exit();
    this.core.events.flush();
  }

  async testAction(data) {
    if (isProd) return;
    switch (data.action) {
      case 'addUnit':{
        const unit = this.core.inventory.getRandomUnit();
        this.core.inventory.addUnit(unit);
        break;
      }
      case 'clearUnits':{
        this.core.game.clearSquad();
        this.core.inventory.setUnits([]);
        break;
      }
      case 'increaseUnitExp':{
        this.core.inventory.addExp(data.unitId, data.exp);
        break;
      }
      case 'buildSquad':{
        this.core.game.buildSquad();
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
