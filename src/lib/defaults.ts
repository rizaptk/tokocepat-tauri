import { StoreConfig } from './types';

/**
 * Used until the real `store_config/main` document exists. DbProvider seeds a
 * default doc on boot, but the cashier engine must never run without a config
 * (a missing one silently disables every discount).
 */
export const DEFAULT_STORE_CONFIG: StoreConfig = {
    id: 'main',
    store_name: 'Toko Saya',
    tax_rate: 0.11,
    currency: 'IDR',
};
