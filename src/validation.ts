export function exist(value: any) {
    return value !== undefined && value !== null;
}

export function isNumber(value: any) {
    return isNumber(value) && !isNaN(value);
}
