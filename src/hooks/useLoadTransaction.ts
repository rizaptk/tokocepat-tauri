import { useEffect, useState } from 'react';
import { useDbStore } from '@/lib/db-store';
import { Transaction } from '@/lib/types';

interface DateRange {
    from?: Date;
    to?: Date;
}

type DeviceScope = string | 'all' | undefined;

export function useLoadTransactions(range?: DateRange, device?: DeviceScope) {
    const { firesqlite, db, isInitialized } = useDbStore();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    
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
            const fetchedTxs = snap.docs.map((d: any) => ({
                ...d.data(),
                id: d.id
            })) as Transaction[];
            
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