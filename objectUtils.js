const _ = require("lodash");

module.exports = {
    intersectionObjects2(a, b, areEqualFunction) {
        var results = [];

        for (var i = 0; i < a.length; i++) {
            var aElement = a[i];
            var existsInB = _.any(b, bElement => {
                return areEqualFunction(bElement, aElement);
            });

            if (existsInB) {
                results.push(aElement);
            }
        }

        return results;
    },

    intersection() {
        var results = arguments[0];
        var lastArgument = arguments[arguments.length - 1];
        var arrayCount = arguments.length;
        var areEqualFunction = _.isEqual;

        if (typeof lastArgument === "function") {
            areEqualFunction = lastArgument;
            arrayCount--;
        }

        for (var i = 1; i < arrayCount; i++) {
            var array = arguments[i];
            results = this._intersectionObjects2(results, array, areEqualFunction);
            if (results.length === 0) break;
        }

        return results;
    },
    detectRemovals(oldObj, newObj, changes) {
        let fieldsDetected = false;

        // detect removed fields
        for (let i in oldObj) {
            if (i == "_id") {
                continue;
            }

            if (typeof (oldObj[i]) == "object") {
                if (!newObj.hasOwnProperty(i)) {
                    changes[i] = "";
                    fieldsDetected = true;
                } else {
                    let innerChanges = {};
                    if (this.detectRemovals(oldObj[i], newObj[i], innerChanges)) {
                        fieldsDetected = true;
                        changes[i] = innerChanges;
                    }
                }
            } else {
                if (!newObj || !newObj.hasOwnProperty(i)) {
                    changes[i] = "";
                    fieldsDetected = true;
                }
            }
        }

        return fieldsDetected;
    },

    // TODO support arrays
    detectChanges(oldObj, newObj, changes) {
        let fieldsDetected = false;

        //detect new fields
        for (let i in newObj) {
            if (i == "_id") {
                continue;
            }

            const newObject = newObj[i];
            const oldObject = oldObj[i];

            if (Array.isArray(newObject) || Array.isArray(oldObject)) {
                //skip arrays
                continue;
            }

            if (typeof (newObj[i]) == "object") {
                if (!oldObj.hasOwnProperty(i)) {
                    changes[i] = newObject;
                    fieldsDetected = true;
                } else {
                    let innerChanges = {};
                    if (this.detectChanges(oldObject, newObject, innerChanges)) {
                        fieldsDetected = true;
                        changes[i] = innerChanges;
                    }
                }
            } else {
                if (!oldObj || !oldObj.hasOwnProperty(i) || oldObject !== newObject) {
                    changes[i] = newObject;
                    fieldsDetected = true;
                }
            }
        }

        return fieldsDetected;
    }
}