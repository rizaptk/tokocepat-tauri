import { CartItem, StoreConfig } from '@/lib/types';

/**
 * Tax rate for a single cart line, honoring category overrides then the store
 * default. Single source of truth used by the cashier UI, checkout, receipts
 * and the discount engine (previously copy-pasted in 5 files).
 */
export const getTaxRateForItem = (item: { category_id?: string }, storeConfig: StoreConfig): number => {
    const { tax_settings, tax_rate } = storeConfig;

    if (!tax_settings) {
        return tax_rate; // Legacy fallback
    }

    if (item.category_id) {
        const override = tax_settings.category_overrides.find(
            co => co.category_id === item.category_id
        );
        if (override && typeof override.tax_rate === 'number') {
            return override.tax_rate;
        }
    }

    return tax_settings.default_rate;
};

export const lineGross = (item: CartItem): number => item.price * item.quantity;