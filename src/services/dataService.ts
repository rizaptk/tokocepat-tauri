import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';

export type LicenseDbData = {
    jwt: string;
    lastKnownTime: string;
    deviceId: string;
}

export const resetApplicationData = async (): Promise<{ success: boolean, message?: string }> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    // Bisnis: dihapus. Preserved: catalog, app_state (lisensi & state), __firelite_security, dll.
    const collectionsToClear = [
        'products',
        'product_variants',
        'categories',
        'transactions',
        'stock_movements',
        'shifts',
        'pending_carts',
        'store_config',
        'promos',
        'customers',
        'customer_groups',
        'customer_payments',
        'worksheet_sessions',
    ];
    const { collection, query, deleteDocs, getDocs } = firesqlite as any;

    try {
        // 1) Hapus subcollections worksheet_sessions/*/items sebelum induk (firelite subcollection orphan).
        try {
            const snap = await getDocs(query(collection(db, 'worksheet_sessions')));
            const itemDeletions: Promise<any>[] = [];
            for (const d of snap.docs || []) {
                const sid = (d as any).id || (d.data && d.data().id);
                if (!sid) continue;
                itemDeletions.push(deleteDocs(query(collection(db, `worksheet_sessions/${sid}/items`))));
            }
            if (itemDeletions.length) await Promise.all(itemDeletions);
        } catch {
            // best-effort: lanjut hapus induk meski subcollection gagal
        }

        const toDelete = collectionsToClear.map((col) => {
            const collectionRef = collection(db, col);
            return deleteDocs(query(collectionRef));
        });

        // Optimistic UI — store yang di-load via DbProvider onSnapshot akan kosong otomatis,
        // tapi setState langsung agar UI tidak menunggu round-trip.
        useStore.setState({
            products: [],
            productVariants: [],
            categories: [],
            transactions: [],
            shifts: [],
            activeShift: null as any,
            pendingCarts: [],
            stockMovements: [],
            promos: [],
            customers: [],
            customerGroups: [],
            storeConfig: {
                store_name: '',
                id: 'main',
                currency: 'Rp',
                tax_rate: 0.11,
                address: '',
            } as any,
        } as any);

        await Promise.all(toDelete);

        return { success: true };

    } catch (error: any) {
        console.error("Failed to reset application data:", error);
        return { success: false, message: error.message || "An unknown error occurred during data reset." };
    } 
};

export const saveLicenseData = async (jwt: string, deviceId: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, setDoc } = firesqlite;

    const data: LicenseDbData = {
        jwt,
        lastKnownTime: new Date().toISOString(),
        deviceId: deviceId,
    };
    
    // Use set with merge to ensure we don't overwrite other app_state fields
    await setDoc(doc(db, 'app_state', 'license'), data, { merge: true });
};

export const getLicenseData = async (): Promise<LicenseDbData | null> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) {
        // In mock mode, return null to indicate no license data
        console.log("Database not initialized, returning null for license data");
        return null;
    }
    const { doc, getDoc } = firesqlite;

    const docRef = doc(db, 'app_state', 'license');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data() as LicenseDbData;
    }
    return null;
};
