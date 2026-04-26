
import { Shift, Transaction } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { generateDeviceFingerprint } from '@/lib/security';

export const openShift = async (openingCash: number): Promise<void> => {
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
        status: 'open',
        device
    };
    await setDoc(doc(db, 'shifts', newShift.id), newShift);
};

export const closeShift = async (activeShift: Shift, transactions: Transaction[], declaredCash: number): Promise<void> => {
    
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, updateDoc } = firesqlite;

    const activeTransactions = transactions.filter(t => t.shift_id === activeShift.id && t.status === 'paid');
    const system_cash = activeShift.opening_cash + activeTransactions.reduce((_, t) => t.total, 0);

    const updatedShift: Partial<Shift> = {
        closed_at: new Date().toISOString(),
        declared_cash: declaredCash,
        system_cash: system_cash,
        variance: declaredCash - system_cash,
        status: 'closed'
    };

    await updateDoc(doc(db, 'shifts', activeShift.id), updatedShift);
};
