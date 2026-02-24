"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ProductGrid } from '@/components/ProductGrid';
import { Cart } from '@/components/Cart';
import { MobileCart } from '@/components/MobileCart';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { Product, ProductVariant, ModifierGroup, Transaction, Shift, StoreConfig } from '@/lib/types';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { seedDatabase } from '@/lib/database';

export default function CashierPage() {
  const products = useStore((state) => state.products);
  const setProducts = useStore((state) => state.setProducts);
  const setProductVariants = useStore((state) => state.setProductVariants);
  const setModifierGroups = useStore((state) => state.setModifierGroups);
  const setTransactions = useStore((state) => state.setTransactions);
  const setShifts = useStore((state) => state.setShifts);
  const setStoreConfig = useStore((state) => state.setStoreConfig);
  const activeShift = useStore((state) => state.activeShift);
  const openShift = useStore((state) => state.openShift);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState(0);

  const { isInitialized, db, firesqlite } = useDbStore();

  useEffect(() => {
    if (!isInitialized || !db || !firesqlite) return;

    let unsubProducts: (() => void) | undefined;
    let unsubVariants: (() => void) | undefined;
    let unsubModifiers: (() => void) | undefined;
    let unsubTransactions: (() => void) | undefined;
    let unsubShifts: (() => void) | undefined;
    let unsubStoreConfig: (() => void) | undefined;

    const setupData = async () => {
      try {
        await seedDatabase(firesqlite, db);
        
        const { collection, doc, onSnapshot } = firesqlite;
        
        unsubStoreConfig = onSnapshot(doc(db, 'store_config', 'main'), (docSnap: any) => {
            if (docSnap.exists()) {
                setStoreConfig(docSnap.data() as StoreConfig);
            }
        });
        
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

        unsubTransactions = onSnapshot(collection(db, 'transactions'), (snapshot: any) => {
            const transactionList = snapshot.docs.map((doc: any) => doc.data() as Transaction);
            setTransactions(transactionList);
        });

        unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot: any) => {
          const shiftList = snapshot.docs.map((doc: any) => doc.data() as Shift);
          setShifts(shiftList);
      });

      } catch (error: any) {
        console.error("Failed to subscribe to data:", error);
        setIsDataLoading(false);
      }
    };

    setupData();

    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubVariants) unsubVariants();
      if (unsubModifiers) unsubModifiers();
      if (unsubTransactions) unsubTransactions();
      if (unsubShifts) unsubShifts();
      if (unsubStoreConfig) unsubStoreConfig();
    };
  }, [isInitialized, db, firesqlite, setProducts, setProductVariants, setModifierGroups, setTransactions, setShifts, setStoreConfig, isDataLoading]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenShift = () => {
    openShift(openingCash);
    setOpeningCash(0);
  }
  
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

  if (!activeShift) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Open a New Shift</CardTitle>
                <CardDescription>Enter the starting cash amount in your drawer to begin making sales.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                    <Label htmlFor="opening-cash" className="sr-only">Opening Cash</Label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                        <Input 
                            id="opening-cash"
                            type="number" 
                            placeholder="Enter opening cash amount" 
                            value={openingCash || ''}
                            onChange={(e) => setOpeningCash(Number(e.target.value))}
                            className="pl-10 text-lg"
                            autoFocus
                        />
                    </div>
                </div>
                <Button onClick={handleOpenShift} className="w-full sm:w-auto" disabled={openingCash <= 0}>
                    <LogIn className="mr-2 h-4 w-4" /> Start Shift
                </Button>
            </CardContent>
        </Card>
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
