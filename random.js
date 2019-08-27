module.exports = {
    range(min, max) {
        return (min + Math.random() * (max - min));
    },
    intRange(min, max) {
        return Math.floor(this.range(min, max));
    }
}