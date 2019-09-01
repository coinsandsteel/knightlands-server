const { Random } = require("random-js");
const random = new Random();

module.exports = {
    range(min, max) {
        return random.real(min, max);
    },
    intRange(min, max) {
        return random.integer(min, max);
    }
}