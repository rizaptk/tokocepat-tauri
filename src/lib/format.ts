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