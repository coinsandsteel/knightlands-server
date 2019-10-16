const { Random } = require("random-js");
const random = new Random();

export default {
    range(min, max, inclusive = false) {
        return random.real(min, max, inclusive);
    },
    intRange(min, max) {
        return random.integer(min, max);
    },
    sample(population, sampleSize) {
        return random.sample(population, sampleSize);
    },
    pick(array) {
        return random.pick(array);
    },
    shuffle(array) {
        return random.shuffle(array);
    }
}