const { Random } = require("random-js");
const random = new Random();
const bounds = require("binary-search-bounds");

const weightSampleComparator = (x, y) => {
    return x.weight - y;
};

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
    },
    sampleWeighted(array, sampleSize) {
        // with replacement
        // array elements must have weight field 
        const sampled = new Array(sampleSize);
        const maxWeight = array[array.length - 1].weight;
        for (let i = 0; i < sampleSize; ++i) {
            let roll = this.intRange(0, maxWeight);
            const index = bounds.gt(array, roll, weightSampleComparator);
            sampled[i] = array[index];
        }

        return sampled;
    }
}