
import { useDbStore } from '@/lib/db-store';

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
