import { Product, ProductVariant, Promotion, Transaction } from './types';

export type NotificationType = 'low_stock' | 'out_of_stock' | 'void' | 'promo_expiry';

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    description: string;
    timestamp: string;
    route: string;
    isRead: boolean;
}

interface BuildNotificationsInput {
    products: Product[];
    productVariants: ProductVariant[];
    transactions: Transaction[];
    activeShiftId?: string;
    promos: Promotion[];
    readNotificationIds: string[];
    dismissedNotificationIds: string[];
}

/**
 * Stable, event-time-based notification builder. Stock notifications use the
 * product/variant `updated_at` (written on every stock mutation) so they carry
 * the moment stock actually changed instead of "now" on every render.
 */
const stockTimestamp = (updatedAt?: string) =>
    updatedAt || new Date().toISOString();

const EXPIRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function buildNotifications(input: BuildNotificationsInput): AppNotification[] {
    const {
        products,
        productVariants,
        transactions,
        activeShiftId,
        promos,
        readNotificationIds,
        dismissedNotificationIds,
    } = input;

    const notifs: Omit<AppNotification, 'isRead'>[] = [];

    // --- Low stock ---
    for (const p of products) {
        if (p.track_stock && !p.has_variant && p.low_stock_alert != null && p.stock > 0 && p.stock <= p.low_stock_alert) {
            notifs.push({
                id: `low-${p.id}`,
                type: 'low_stock',
                title: 'Stok Menipis',
                description: `Sisa stok ${p.name} tinggal ${p.stock}.`,
                timestamp: stockTimestamp(p.updated_at),
                route: '/inventory',
            });
        }
    }
    for (const v of productVariants) {
        if (v.track_stock && v.low_stock_alert != null && v.stock > 0 && v.stock <= v.low_stock_alert) {
            const parent = products.find(p => p.id === v.product_id);
            notifs.push({
                id: `low-${v.id}`,
                type: 'low_stock',
                title: 'Stok Menipis',
                description: `Sisa stok ${parent?.name ?? 'Produk'} (${v.name}) tinggal ${v.stock}.`,
                timestamp: stockTimestamp(v.updated_at),
                route: '/inventory',
            });
        }
    }

    // --- Out of stock ---
    for (const p of products) {
        if (p.track_stock && !p.has_variant && p.stock <= 0) {
            notifs.push({
                id: `out-${p.id}`,
                type: 'out_of_stock',
                title: 'Stok Habis',
                description: `Stok ${p.name} telah kosong.`,
                timestamp: stockTimestamp(p.updated_at),
                route: '/inventory',
            });
        }
    }
    for (const v of productVariants) {
        if (v.track_stock && v.stock <= 0) {
            const parent = products.find(p => p.id === v.product_id);
            notifs.push({
                id: `out-${v.id}`,
                type: 'out_of_stock',
                title: 'Stok Habis',
                description: `Stok ${parent?.name ?? 'Produk'} (${v.name}) telah kosong.`,
                timestamp: stockTimestamp(v.updated_at),
                route: '/inventory',
            });
        }
    }

    // --- Voided transactions in the current shift ---
    if (activeShiftId) {
        for (const tx of transactions) {
            if (tx.shift_id === activeShiftId && tx.status === 'voided' && tx.voided_at) {
                notifs.push({
                    id: `void-${tx.id}`,
                    type: 'void',
                    title: 'Transaksi Void',
                    description: `Invoice ${tx.invoice_number} telah dibatalkan.`,
                    timestamp: tx.voided_at,
                    route: '/dashboard/reports/void',
                });
            }
        }
    }

    // --- Promo / voucher expiry (within ±24h of ends_at) ---
    const now = Date.now();
    for (const promo of promos) {
        if (!promo.ends_at) continue;
        const ends = new Date(promo.ends_at).getTime();
        if (Number.isNaN(ends) || Math.abs(ends - now) > EXPIRY_WINDOW_MS) continue;
        const expired = ends < now;
        notifs.push({
            id: `exp-${promo.id}`,
            type: 'promo_expiry',
            title: expired ? 'Promo Kadaluarsa' : 'Promo Akan Kadaluarsa',
            description: `${promo.name} ${expired ? 'telah berakhir' : 'akan berakhir'}.`,
            timestamp: promo.ends_at,
            route: '/dashboard/promos',
        });
    }

    const dismissed = new Set(dismissedNotificationIds);
    return notifs
        .filter(n => !dismissed.has(n.id))
        .map(n => ({ ...n, isRead: readNotificationIds.includes(n.id) }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 100);
}
