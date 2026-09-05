import { Shift, Transaction } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { generateDeviceFingerprint } from '@/lib/security';
import { useStore } from '@/lib/store';
import { useEffect } from 'react';

export const openShift = async (openingCash: number, openedBy?: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc } = firesqlite;
    const device = await generateDeviceFingerprint();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newShift: Shift = {
        id: id,
        opened_at: now,
        opening_cash: openingCash,
        opened_by: openedBy?.trim() || undefined,
        status: 'open',
        device
    };
    await setDoc(doc(db, 'shifts', newShift.id), newShift);
};

export const closeShift = async (activeShift: Shift, _transactions: Transaction[], declaredCash: number): Promise<void> => {
    
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, updateDoc, collection, query, where, getSumFromServer, orderBy } = firesqlite;

    const tmp = await getSumFromServer(
        query(
            collection(db, 'transactions'),
            where('shift_id','eq',activeShift.id),
            where('status','eq', 'paid'),
            orderBy('created_at', 'desc')
        )
    , 'total');

    // const system_cash = Number(tmp.data().value) + activeShift.opening_cash;
    const system_cash = (Number(tmp.data().value) + activeShift.opening_cash) - (activeShift.total_cash_out || 0);

    const updatedShift: Partial<Shift> = {
        closed_at: new Date().toISOString(),
        declared_cash: declaredCash,
        system_cash: system_cash,
        variance: declaredCash - system_cash,
        status: 'closed'
    };

    await updateDoc(doc(db, 'shifts', activeShift.id), updatedShift);
};

// Removed async so it synchronously returns the unsubscribe function
export const reloadShift = (shift: string): (() => void) => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    
    // Extracted onSnapshot instead of getDocs
    const { onSnapshot, collection, where, query, orderBy } = firesqlite;

    const q = query(
        collection(db, 'transactions'), 
        where('shift_id' ,'eq' , shift),
        orderBy('created_at', 'desc')
    );

    // Set up the real-time listener and store the returned unsubscribe function
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
        const transactions = snapshot.docs.map((d: any) => d.data() as Transaction);
        // Get the freshest state of the store actions and update
        useStore.getState().setTransactions(transactions);
    });

    // Return the unsubscribe function so the caller can clean it up
    return unsubscribe;
}

export function GlobalShiftSync() {
    const activeShift = useStore((state) => state.activeShift);

    useEffect(() => {
        // If there is no active shift, don't do anything
        if (!activeShift) return;

        // This hooks into firelite.onSnapshot.
        // Whenever net_sync updates the local database, this triggers instantly
        // and updates the global Zustand store.
        const unsubscribe = reloadShift(activeShift.id);

        return () => {
            unsubscribe();
        };
    }, [activeShift]);

    return null; // This component is invisible, it just manages data
}