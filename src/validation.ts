export function exist(value: any) {
    return value !== undefined && value !== null;
}

export function isNumber(value: any) {
    if (!exist(value)) {
        return false;
    }
    value = +value;
    return typeof value === 'number' && !isNaN(value);
}
