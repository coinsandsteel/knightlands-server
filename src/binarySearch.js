module.exports = function (haystack, needle, comparator, low, high) {
    var mid, cmp;

    if (low === undefined)
        low = 0;

    else {
        low = low | 0;
        if (low < 0 || low >= haystack.length)
            throw new RangeError("invalid lower bound");
    }

    if (high === undefined)
        high = haystack.length - 1;

    else {
        high = high | 0;
        if (high < low || high >= haystack.length)
            throw new RangeError("invalid upper bound");
    }

    while (low <= high) {
        // The naive `low + high >>> 1` could fail for array lengths > 2**31
        // because `>>>` converts its operands to int32. `low + (high - low >>> 1)`
        // works for array lengths <= 2**32-1 which is also Javascript's max array
        // length.
        mid = low + ((high - low) >>> 1);
        cmp = +comparator(haystack[mid], needle, mid, haystack);

        // Too low.
        if (cmp < 0.0)
            low = mid + 1;

        // Too high.
        else if (cmp > 0.0)
            high = mid - 1;

        // Key found.
        else
            return mid;
    }

    // Key not found.
    return ~low;
}