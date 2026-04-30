
import { Shift, Transaction } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { generateDeviceFingerprint } from '@/lib/security';
import { useStore } from '@/lib/store';

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

export const closeShift = async (activeShift: Shift, _transactions: Transaction[], declaredCash: number): Promise<void> => {
    
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, updateDoc, collection, query, where, getSumFromServer, orderBy } = firesqlite;

    const tmp = await getSumFromServer(
        query(
            collection(db, 'transactions'),
            where('shift_id','eq',activeShift.id),
            orderBy('created_at', 'desc')
        )
    , 'total');
    
    const system_cash = Number(tmp.data().value) + activeShift.opening_cash;

    const updatedShift: Partial<Shift> = {
        closed_at: new Date().toISOString(),
        declared_cash: declaredCash,
        system_cash: system_cash,
        variance: declaredCash - system_cash,
        status: 'closed'
    };

    await updateDoc(doc(db, 'shifts', activeShift.id), updatedShift);
};

export const reloadShift = async (shift: string) => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { getDocs, collection, where, query, orderBy } = firesqlite;
    const store = useStore.getState();

    const data = await getDocs(
        query(
            collection(db, 'transactions'), 
            where('shift_id' ,'eq' , shift),
            orderBy('created_at', 'desc')
        )
    )
    const transactions = data.docs.map(d => d.data() as Transaction);
    store.setTransactions(transactions);
}
