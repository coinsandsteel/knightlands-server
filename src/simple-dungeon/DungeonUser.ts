import { AltarData, DungeonUserState } from "./types";

export class DungeonUser {
    private _state: DungeonUserState;

    constructor(state: DungeonUserState) {
        this._state = state;
    }

    get position() {
        return this._state.cell;
    }

    get health() {
        return 100;
    }

    moveTo(cellId: number) {
        this._state.cell = cellId;
    }

    useAltar(altar: AltarData) {

    }
}