const { Random } = require("random-js");
const random = new Random();

export default {
    range(min, max, inclusive = false) {
        return random.real(min, max, inclusive);
    },
    intRange(min, max) {
        return random.integer(min, max);
    }
}