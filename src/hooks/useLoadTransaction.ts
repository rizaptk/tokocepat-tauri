import { useEffect } from 'react';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';
import { Transaction } from '@/lib/types';

interface DateRange {
    from?: Date;
    to?: Date;
}

export function useLoadTransactions(range?: DateRange) {
    const { firesqlite, db, isInitialized } = useDbStore();
    const { setTransactions } = useStore();

    useEffect(() => {
        if (!isInitialized || !firesqlite || !db) return;

        const { collection, query, where, orderBy, onSnapshot } = firesqlite;

        // 1. Stabilize date strings
        const fromDate = (range?.from || new Date(new Date().setDate(new Date().getDate() - 30))).toISOString();
        const toDate = (range?.to || new Date()).toISOString();

        const currentItems = useStore.getState().transactions;
        const filtered = currentItems.filter(t => new Date(t.created_at) >= new Date(fromDate) && new Date(t.created_at) <= new Date(toDate));
        setTransactions(filtered);

        const txQuery = query(
            collection(db, 'transactions'),
            where('created_at', 'gte', fromDate),
            where('created_at', 'lte', toDate),
            orderBy('created_at', 'desc')
        );

        let isInitialLoad = true;

        // 2. Call onSnapshot DIRECTLY. It returns the unsubscribe function.
        const unsubscribe = onSnapshot(txQuery, (snap: any) => {
            if (isInitialLoad) {
                const initialTxs = snap.docs.map((d: any) => ({
                    ...d.data(),
                    id: d.id
                })) as Transaction[];
                setTransactions(initialTxs);
                isInitialLoad = false;
            } else {
                const changes = snap.docChanges();
                const latestItems = useStore.getState().transactions;
                let updatedList = [...latestItems];

                changes.forEach((change: any) => {
                    const docData = change.doc.data() as Transaction;
                    const docId = change.doc.id;
                    const tx = { ...docData, id: docId };

                    if (change.type === 'added') {
                        if (!updatedList.find(t => t.id === docId)) updatedList.push(tx);
                    } else if (change.type === 'modified') {
                        updatedList = updatedList.map(t => t.id === docId ? tx : t);
                    } else if (change.type === 'removed') {
                        updatedList = updatedList.filter(t => t.id !== docId);
                    }
                });
                setTransactions(updatedList);
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
        
        // Dependency array: only re-run if dates actually change
    }, [isInitialized, firesqlite, db, range?.from?.getTime(), range?.to?.getTime(), setTransactions]);
}