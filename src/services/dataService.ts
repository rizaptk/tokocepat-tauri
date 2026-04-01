import { useDbStore } from '@/lib/db-store';
import { clearBackupConfig } from '@/lib/backupService';

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
        'modifier_groups',
        'raw_ingredients',
        'recipes',
        'transactions',
        'stock_movements',
        'shifts',
        'pending_carts',
        'store_config',
        // 'app_state' is intentionally omitted to preserve license data
    ];
    const { collection, getDocs, writeBatch, doc } = firesqlite;

    try {
        for (const collectionName of collectionsToClear) {
            const collectionRef = collection(db, collectionName);
            const snapshot = await getDocs(collectionRef);

            if (snapshot.empty) continue;

            const batch = writeBatch(db);
            snapshot.docs.forEach((d: any) => {
                batch.delete(doc(db, collectionName, d.id));
            });
            await batch.commit();
        }
        
        // Clear backup file handle from IndexedDB
        await clearBackupConfig();

        // Remove the database version key to trigger re-seeding on next load
        localStorage.removeItem('tokoc_db_version');
        
        // Set a flag to prevent seeding on next app load
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

export const deleteLicenseData = async (): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, deleteDoc } = firesqlite;
    
    await deleteDoc(doc(db, 'app_state', 'license'));
};
