

import { useDbStore } from '@/lib/db-store';

export type LicenseDbData = {
    jwt: string;
    lastKnownTime: string;
    deviceId: string;
}

export const clearTransactionData = async (): Promise<{ success: boolean, message?: string }> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const collectionsToClear = ['transactions', 'stock_movements', 'shifts', 'pending_carts'];
    const { collection, getDocs, writeBatch, doc } = firesqlite;

    try {
        for (const collectionName of collectionsToClear) {
            const collectionRef = collection(db, collectionName);
            const snapshot = await getDocs(collectionRef);

            if (snapshot.empty) continue;

            const batch = writeBatch(db);
            snapshot.docs.forEach((d: any) => {
                // Construct a DocumentReference for the batch delete
                batch.delete(doc(db, collectionName, d.id)); 
            });
            await batch.commit();
        }
        return { success: true };
    } catch (error: any) {
        console.error("Failed to clear transaction data:", error);
        return { success: false, message: error.message || "An unknown error occurred during data clearing." };
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
    if (!db || !firesqlite) throw new Error("Database not initialized");
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
