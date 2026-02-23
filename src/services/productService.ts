'use client';

import { getFirestore, collection, onSnapshot } from 'firesqlite';
import type { Product } from '@/lib/types';

export function subscribeToProducts(
    onUpdate: (products: Product[]) => void, 
    onError: (error: Error) => void
) {
    try {
        const db = getFirestore();
        if (!db) {
            // This should not happen if initializeDatabase is called first.
            throw new Error("Firestore not initialized. Call initializeDatabase first.");
        }
        const productsCollection = collection(db, 'products');

        const unsubscribe = onSnapshot(productsCollection, (snapshot) => {
            const productList = snapshot.docs.map(doc => doc.data() as Product);
            onUpdate(productList);
        }, (error) => {
            console.error("Error in product subscription:", error);
            onError(error);
        });

        return unsubscribe;
    } catch(e) {
        onError(e as Error);
        return () => {};
    }
}
