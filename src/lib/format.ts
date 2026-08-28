// Shared money formatting — the single source of truth, per the no-decimal,
// tabular-Rupiah rule. Every surface formats Rupiah the same way.

export const formatIDR = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);

export const formatIDNumber = (amount: number) =>
    new Intl.NumberFormat('id-ID').format(Math.round(amount));

export const isCompactable = (n: number) => n >= 100000 && n % 1000 === 0;
export const formatCompactIDR = (amount: number) => {
    if (isCompactable(amount)) return `${amount / 1000}K`;
    return formatIDR(amount);
};