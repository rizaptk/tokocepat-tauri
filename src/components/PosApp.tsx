"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ProductGrid } from '@/components/ProductGrid';
import { Cart } from '@/components/Cart';
import { MobileCart } from '@/components/MobileCart';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { initialProducts, initialVariants, initialModifierGroups } from '@/lib/products';
import { Product, ProductVariant, ModifierGroup } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { TokoCepatLogo } from './TokoCepatLogo';

const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.1';

export default function PosApp() {
  const products = useStore((state) => state.products);
  const setProducts = useStore((state) => state.setProducts);
  const setProductVariants = useStore((state) => state.setProductVariants);
  const setModifierGroups = useStore((state) => state.setModifierGroups);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Use the new DB store
  const { isInitialized, db, firesqlite } = useDbStore();

  useEffect(() => {
    // Wait for the DB to be initialized
    if (!isInitialized || !db || !firesqlite) return;

    let unsubProducts: (() => void) | undefined;
    let unsubVariants: (() => void) | undefined;
    let unsubModifiers: (() => void) | undefined;

    const setupData = async () => {
      try {
        // De-structure firesqlite functions
        const { collection, onSnapshot, getDocs, doc, setDoc } = firesqlite;
        
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
          if (isDataLoading) setIsDataLoading(false);
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
        console.error("Failed to subscribe to data:", error);
        setIsDataLoading(false);
      }
    };

    setupData();

    return () => {
      // Cleanup subscriptions on component unmount
      if (unsubProducts) unsubProducts();
      if (unsubVariants) unsubVariants();
      if (unsubModifiers) unsubModifiers();
    };
  }, [isInitialized, db, firesqlite, setProducts, setProductVariants, setModifierGroups, isDataLoading]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Show a global loading state until DB is ready
  if (!isInitialized) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <TokoCepatLogo />
            <p className="text-muted-foreground">Initializing Database...</p>
            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-full"></div>
            </div>
          </div>
        </div>
      )
  }

  return (
    <div className="flex h-screen w-full bg-muted/40">
      <div className="flex flex-col flex-1">
        <Header searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <ProductGrid products={filteredProducts} isLoading={isDataLoading} />
        </main>
      </div>
      <Cart />
      <MobileCart />
    </div>
  );
}
