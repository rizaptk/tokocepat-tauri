
import { Shift, Transaction } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

export const openShift = async (openingCash: number): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc } = firesqlite;
    const now = new Date().toISOString();
    const newShift: Shift = {
        id: now,
        opened_at: now,
        opening_cash: openingCash,
        status: 'open'
    };
    await setDoc(doc(db, 'shifts', newShift.id), newShift);
};

export const closeShift = async (activeShift: Shift, transactions: Transaction[], declaredCash: number): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, updateDoc } = firesqlite;

    const activeTransactions = transactions.filter(t => t.shift_id === activeShift.id && t.status === 'paid');
    const system_cash = activeShift.opening_cash + activeTransactions.reduce((sum, t) => t.total, 0);

    const updatedShift: Partial<Shift> = {
        closed_at: new Date().toISOString(),
        declared_cash: declaredCash,
        system_cash: system_cash,
        variance: declaredCash - system_cash,
        status: 'closed'
    };

    await updateDoc(doc(db, 'shifts', activeShift.id), updatedShift);
};
