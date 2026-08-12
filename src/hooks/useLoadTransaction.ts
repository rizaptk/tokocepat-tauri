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

        const fromDate = (range?.from || new Date(new Date().setDate(new Date().getDate() - 30))).toISOString();
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