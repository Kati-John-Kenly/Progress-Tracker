export const formatAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '0';

    const rounded = Number(amount.toFixed(2));
    return String(Object.is(rounded, -0) ? 0 : rounded);
};
