import type { Transaction, TransactionItem } from './types';

/**
 * Version of the event-stored money formula. Stored per tx doc (`money_v`).
 * Readers trust `hpp_standard` / `payout_consignment` only when the doc's
 * version matches; otherwise they derive from line items (legacy docs).
 * Bump when the cost-split definition changes.
 */
export const MONEY_VERSION = 1;

export interface TxCostSplit {
    hppStandard: number;
    payoutConsignment: number;
}

/**
 * Single definition of the tx-level cost split. Cost basis is always the
 * line's stored `cost_snapshot` (frozen at write time, incl. consignment
 * effective cost) — never the live product master. Negative-qty return
 * lines negate automatically, mirroring how return totals net.
 */
export function splitTxCosts(items: TransactionItem[]): TxCostSplit {
    let hppStandard = 0;
    let payoutConsignment = 0;
    for (const item of items || []) {
        const costVal = (item.cost_snapshot || 0) * item.qty;
        if (item.product_snapshot?.is_consignment) payoutConsignment += costVal;
        else hppStandard += costVal;
    }
    return { hppStandard, payoutConsignment };
}

/** Cost split for a tx: stored scalars when versioned, legacy derivation otherwise. */
export function txCosts(tx: Transaction): { std: number; payout: number } {
    if (
        tx.money_v === MONEY_VERSION &&
        typeof tx.hpp_standard === 'number' &&
        typeof tx.payout_consignment === 'number'
    ) {
        return { std: tx.hpp_standard, payout: tx.payout_consignment };
    }
    const s = splitTxCosts(tx.items || []);
    return { std: s.hppStandard, payout: s.payoutConsignment };
}

/** Gross profit for a tx from event-stored (or legacy-derived) money data. */
export function txProfit(tx: Transaction): number {
    const { std, payout } = txCosts(tx);
    return tx.subtotal - (tx.discount_total || 0) - std - payout;
}
