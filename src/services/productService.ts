'use client';

import { collection, onSnapshot } from 'firesqlite';
import { getDb } from '@/lib/database';
import type { Product } from '@/lib/types';

export async function subscribeToProducts(
    onUpdate: (products: Product[]) => void, 
    onError: (error: Error) => void
) {
    try {
        const db = await getDb();
        const productsCollection = collection(db, 'products');

        const unsubscribe = onSnapshot(productsCollection, (snapshot: any) => {
            const productList = snapshot.docs.map((doc: any) => doc.data() as Product);
            onUpdate(productList);
        }, (error: Error) => {
            console.error("Error in product subscription:", error);
            onError(error);
        });

        return unsubscribe;
    } catch(e) {
        onError(e as Error);
        return () => {};
    }
}
