import { useEffect, useState } from 'react';
import { useDbStore } from '@/lib/db-store';
import { Transaction } from '@/lib/types';

export function useLoadShiftTransactions(shiftId?: string) {
    const { firesqlite, db, isInitialized } = useDbStore();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(!!shiftId);

    useEffect(() => {
        if (!isInitialized || !firesqlite || !db || !shiftId) return;

        setIsLoading(true);

        const { collection, query, where, orderBy, onSnapshot } = firesqlite;

        const q = query(
            collection(db, 'transactions'),
            where('shift_id', 'eq', shiftId),
            orderBy('created_at', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snap: any) => {
            const txs = snap.docs.map((d: any) => ({ ...d.data(), id: d.id })) as Transaction[];
            setTransactions(txs);
            setIsLoading(false);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isInitialized, firesqlite, db, shiftId]);

    return { transactions, isLoading };
}