import { EventEmitter } from "events";

export class Lock {
    _locked: any;
    _ee: EventEmitter;

    constructor() {
        this._locked = {};
        this._ee = new EventEmitter();
        this._ee.setMaxListeners(0);
    }

    acquire(key: string | symbol) {
        return new Promise(resolve => {
            if (!this._locked[key]) {
                this._locked[key] = true;
                return resolve();
            }

            const tryAcquire = value => {
                if (!this._locked[key]) {
                    this._locked[key] = true;
                    this._ee.removeListener(key, tryAcquire);
                    return resolve(value);
                }
            };

            this._ee.on(key, tryAcquire);
        })
    }

    // If we pass a value, on release this value
    // will be propagated to all the code that's waiting for
    // the lock to release
    release(key: string | symbol, value?: any[]) {
        Reflect.deleteProperty(this._locked, key);
        setImmediate(() => this._ee.emit(key, value));
    }
};