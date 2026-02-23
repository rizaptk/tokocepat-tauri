"use client";

import { collection, onSnapshot } from 'firesqlite';
import { getDb } from '@/lib/database';
import { Product } from '@/lib/types';

export function subscribeToProducts(
  onUpdate: (products: Product[]) => void,
  onError: (error: Error) => void
): () => void {
  try {
    const db = getDb();
    const productsCollection = collection(db, 'products');
    
    const unsubscribe = onSnapshot(productsCollection, (snapshot: any) => {
      const productList = snapshot.docs.map((doc: any) => doc.data() as Product);
      onUpdate(productList);
    }, (error: Error) => {
      console.error("Error in product subscription:", error);
      onError(error);
    });

    return unsubscribe;
  } catch (error: any) {
    console.error("Failed to subscribe to products:", error);
    onError(error);
    return () => {}; // Return a no-op function on failure
  }
}
