import User from '../user'
import Game from '../game'
import { Collections } from '../database/database';
import { FarmState } from './types';

export class Farm {
    private _user: User;
    private _state: FarmState;

    constructor(user: User) {
        this._user = user;
    }

    async load() {
        const state = await Game.db.collection(Collections.FarmUsers).findOne({ _id: this._user.id });
        if (state) {
            this._state = state;
        }


    }

    async save() {
        await Game.db.collection(Collections.FarmUsers).updateOne({ _id: this._user.id }, { $set: this._state });
    }

    async unlockNextBuilding() {
        
    } 
}