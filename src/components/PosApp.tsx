"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ProductGrid } from '@/components/ProductGrid';
import { Cart } from '@/components/Cart';
import { MobileCart } from '@/components/MobileCart';
import { useStore } from '@/lib/store';
import { initialProducts } from '@/lib/products';
import { Product } from '@/lib/types';

const DB_NAME = 'tokoc-db';
const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.0';

export default function PosApp() {
  const products = useStore((state) => state.products);
  const setProducts = useStore((state) => state.setProducts);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      try {
        const { 
          initializeFirestoreSQLite, 
          getFirestore, 
          collection, 
          onSnapshot,
          getDocs,
          doc,
          setDoc
        } = await import('firesqlite');

        await initializeFirestoreSQLite(DB_NAME);
        const db = getFirestore();
        
        // Seeding logic
        const storedVersion = localStorage.getItem(DB_VERSION_KEY);
        if (storedVersion !== CURRENT_DB_VERSION) {
          console.log('Database version mismatch or not set. Seeding data...');
          const productsCollectionRef = collection(db, 'products');
          const existingDocs = await getDocs(productsCollectionRef);

          if (existingDocs.docs.length === 0) {
            console.log('No existing products found. Seeding initial products...');
            const seedPromises = initialProducts.map((product: Product) => {
              const productRef = doc(db, 'products', product.id);
              return setDoc(productRef, product);
            });
            await Promise.all(seedPromises);
            console.log('Seeding complete.');
          } else {
            console.log('Products already exist, skipping seed.');
          }
          
          localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
        } else {
          console.log("Database version is up to date.");
        }
        
        // Snapshot listener
        const productsCollection = collection(db, 'products');
        unsubscribe = onSnapshot(productsCollection, (snapshot: any) => {
          const productList = snapshot.docs.map((doc: any) => doc.data() as Product);
          setProducts(productList);
          setIsLoading(false);
        }, (error: Error) => {
          console.error("Error in product subscription:", error);
          setIsLoading(false);
        });

      } catch (error: any) {
        console.error("Failed to initialize or subscribe to products:", error);
        setIsLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setProducts]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full bg-muted/40">
      <div className="flex flex-col flex-1">
        <Header searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <ProductGrid products={filteredProducts} isLoading={isLoading} />
        </main>
      </div>
      <Cart />
      <MobileCart />
    </div>
  );
}
