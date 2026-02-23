'use client';

import type { Product } from '@/lib/types';

export function subscribeToProducts(
    { fsLib, dbInstance }: { fsLib: any; dbInstance: any },
    onUpdate: (products: Product[]) => void, 
    onError: (error: Error) => void
) {
    try {
        const { collection, onSnapshot } = fsLib;

        const productsCollection = collection(dbInstance, 'products');

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
