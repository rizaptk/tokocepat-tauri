"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ProductGrid } from '@/components/ProductGrid';
import { Cart } from '@/components/Cart';
import { MobileCart } from '@/components/MobileCart';
import { useStore } from '@/lib/store';
import { initialProducts, initialVariants, initialModifierGroups } from '@/lib/products';
import { Product, ProductVariant, ModifierGroup } from '@/lib/types';

const DB_NAME = 'tokoc-db';
const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.1'; // Bump version for new schema

export default function PosApp() {
  const products = useStore((state) => state.products);
  const setProducts = useStore((state) => state.setProducts);
  const setProductVariants = useStore((state) => state.setProductVariants);
  const setModifierGroups = useStore((state) => state.setModifierGroups);

  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMount, setIsMount] = useState(false);

  useEffect(() => {
    setIsMount(true);
  }, []);

  useEffect(() => {
    if (!isMount) return;

    let unsubProducts: (() => void) | undefined;
    let unsubVariants: (() => void) | undefined;
    let unsubModifiers: (() => void) | undefined;

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

        const wasmUrl = new URL('/wa-sqlite-async.wasm', window.location.origin).href;
        await initializeFirestoreSQLite(wasmUrl, DB_NAME);
        const db = getFirestore();
        
        // Seeding logic
        const storedVersion = localStorage.getItem(DB_VERSION_KEY);
        if (storedVersion !== CURRENT_DB_VERSION) {
          console.log('Database version mismatch or not set. Seeding data...');
          
          // Products
          const productsCollectionRef = collection(db, 'products');
          const existingProds = await getDocs(productsCollectionRef);
          if (existingProds.docs.length === 0) {
            console.log('Seeding initial products...');
            const seedPromises = initialProducts.map((product: Product) => 
              setDoc(doc(db, 'products', product.id), product)
            );
            await Promise.all(seedPromises);
          }
          
          // Variants
          const variantsCollectionRef = collection(db, 'product_variants');
          const existingVariants = await getDocs(variantsCollectionRef);
          if (existingVariants.docs.length === 0) {
            console.log('Seeding initial variants...');
            const seedPromises = initialVariants.map((variant: ProductVariant) => 
              setDoc(doc(db, 'product_variants', variant.id), variant)
            );
            await Promise.all(seedPromises);
          }

          // Modifiers
          const modifiersCollectionRef = collection(db, 'modifier_groups');
          const existingModifiers = await getDocs(modifiersCollectionRef);
          if (existingModifiers.docs.length === 0) {
            console.log('Seeding initial modifiers...');
            const seedPromises = initialModifierGroups.map((group: ModifierGroup) => 
              setDoc(doc(db, 'modifier_groups', group.id), group)
            );
            await Promise.all(seedPromises);
          }

          localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
          console.log('Seeding complete.');
        } else {
          console.log("Database version is up to date.");
        }
        
        // Snapshot listeners
        unsubProducts = onSnapshot(collection(db, 'products'), (snapshot: any) => {
          const productList = snapshot.docs.map((doc: any) => doc.data() as Product);
          setProducts(productList);
          if (isLoading) setIsLoading(false);
        });

        unsubVariants = onSnapshot(collection(db, 'product_variants'), (snapshot: any) => {
            const variantList = snapshot.docs.map((doc: any) => doc.data() as ProductVariant);
            setProductVariants(variantList);
        });

        unsubModifiers = onSnapshot(collection(db, 'modifier_groups'), (snapshot: any) => {
            const groupList = snapshot.docs.map((doc: any) => doc.data() as ModifierGroup);
            setModifierGroups(groupList);
        });

      } catch (error: any) {
        console.error("Failed to initialize or subscribe to data:", error);
        setIsLoading(false);
      }
    };

    setup();

    return () => {
      if (isMount) {
        if (unsubProducts) unsubProducts();
        if (unsubVariants) unsubVariants();
        if (unsubModifiers) unsubModifiers();
      }
    };
  }, [setProducts, setProductVariants, setModifierGroups, isMount]);

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
