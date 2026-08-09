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

    const collectionsToClear = [
        'products',
        'product_variants',
        'categories',
        'transactions',
        'stock_movements',
        'shifts',
        'pending_carts',
        'store_config',
    ];
    const { collection, query, deleteDocs } = firesqlite;

    try {
        const toDelete = collectionsToClear.map((col) => {
            const collectionRef = collection(db, col);
            return deleteDocs(query(collectionRef));
        })

        useStore.setState({
            transactions: [],
            stockMovements: [],
            storeConfig: {
                store_name: '',
                id: 'main',
                currency: 'Rp',
                tax_rate: 0.11,
                address: '',
            }
        });

        await Promise.all(toDelete);
        localStorage.setItem('tokoc_db_version','0');
        localStorage.setItem('tokoc_reset_flag', 'true');

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
