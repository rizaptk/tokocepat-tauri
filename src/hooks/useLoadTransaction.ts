import { useEffect, useState } from 'react';
import { useDbStore } from '@/lib/db-store';
import { Transaction } from '@/lib/types';
import { txCosts } from '@/lib/money';

interface DateRange {
    from?: Date;
    to?: Date;
}

type DeviceScope = string | 'all' | undefined;

/**
 * Transaction with report aggregates precomputed once per snapshot.
 * Reports re-derive stats/filters/rows from these scalars instead of
 * re-walking `items` (each carrying a full product_snapshot) on every
 * render. Extra fields are additive, so all existing consumers keep working.
 */
export type TxRow = Transaction & {
    /** HPP split: standard store cost (cost_snapshot * qty). */
    _stdCost: number;
    /** HPP split: consignment payout (cost_snapshot * qty). */
    _payout: number;
    /** Lowercase invoice + customer haystack for search. */
    _hay: string;
};

export function useLoadTransactions(range?: DateRange, device?: DeviceScope) {
    const { firesqlite, db, isInitialized } = useDbStore();
    const [transactions, setTransactions] = useState<TxRow[]>([]);
    
    // Add loading state
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!isInitialized || !firesqlite || !db) return;

        // Whenever the date range changes, immediately show loading
        setIsLoading(true);

        const { collection, query, where, orderBy, onSnapshot } = firesqlite;

        // Piutang can be older than 30 days (overdue buckets up to >30).
        // For the dedicated Piutang page we use a 1-year lookback when no
        // range is supplied; report pages still pass their own range.
        const defaultFrom = (() => {
            const d = new Date();
            d.setDate(d.getDate() - 365);
            return d;
        })();
        const fromDate = (range?.from || defaultFrom).toISOString();
        const toDate = (range?.to || new Date()).toISOString();

        const constraints = [
            where('created_at', 'gte', fromDate),
            where('created_at', 'lte', toDate),
        ];
        if (device && device !== 'all') {
            constraints.push(where('device', 'eq', device));
        }
        constraints.push(orderBy('created_at', 'desc'));

        const txQuery = query(collection(db, 'transactions'), ...constraints);

        const unsubscribe = onSnapshot(txQuery, (snap: any) => {
            // Single pass: snapshot -> rows + aggregates + search haystack.
            // Costs come from event-stored scalars (legacy docs derive).
            const fetchedTxs = snap.docs.map((d: any) => {
                const data = { ...d.data(), id: d.id } as Transaction;
                const { std, payout } = txCosts(data);
                const tx = data as TxRow;
                tx._stdCost = std;
                tx._payout = payout;
                tx._hay = `${data.invoice_number || ''} ${(data as any).customer_name_snapshot || ''}`.toLowerCase();
                return tx;
            }) as TxRow[];

            setTransactions(fetchedTxs);
            setIsLoading(false); // Hide loading once data is mapped
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
        
    }, [isInitialized, firesqlite, db, range?.from?.getTime(), range?.to?.getTime(), device]);

    // Return both the data and the loading state
    return { transactions, isLoading };
}